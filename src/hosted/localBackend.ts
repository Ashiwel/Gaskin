/**
 * This-device-only backend: the offline single file, the USB stick and the
 * PWA. It wraps src/storage (folder on a USB stick, IndexedDB, or backup
 * files), so data lives exactly where the storage module puts it.
 *
 * The saved document is the app's whole state object. This backend owns
 * the record fields (mothers, overrides, proposals, learnedRules, outbound,
 * inbound) and keeps every other top-level field (clock, libraryVersion,
 * alert acknowledgements and the rest) as `meta`, written with saveMeta().
 * So the shape on disk is the same AppState the store saved before hosted
 * backends existed, and old backups still load. In local mode the store
 * should save through this backend only, not also through getAppStore().
 */
import type { ClinicalEvent, InboundMessage, LearnedRule, Mother, OutboundMessage, Override, RuleProposal } from '../types';
import {
  type Backend,
  type BackendNote,
  type BackendStatus,
  type BackendUpdate,
  type HostedSnapshot,
  type SendOptions,
  type SharedMeta,
  BackendError,
  Listeners,
  emptySnapshot,
  noteId,
} from './backend';
import type { AIProxyRequest, AIProxyResponse, Identity, MessageStatusUpdate, SendMessageRequest, SendMessageResponse } from './syncTypes';
import { laterStatus, mergeEvents } from './syncTypes';
import { openKV, type KV } from './kv';
import { refusalFor, simulateDelivery } from './simulate';
import { getAppStore, type GaskinStore } from '../storage';

const RECORD_KEYS = ['mothers', 'overrides', 'proposals', 'learnedRules', 'outbound', 'inbound'] as const;

/** Minimal store surface used here (src/storage's GaskinStore satisfies it) */
export type SnapshotStore = Pick<GaskinStore<Record<string, unknown>>, 'load' | 'save'> & Partial<Pick<GaskinStore<Record<string, unknown>>, 'status' | 'subscribe' | 'flushNow'>>;

export interface LocalBackendOptions {
  store?: SnapshotStore;
  kv?: KV;
  /** Why we are on this device only (shown in status) */
  fallbackReason?: string;
  /** Identity to report; defaults to a local health worker */
  identity?: Partial<Identity>;
}

function upsertById<T extends { id: string }>(list: T[], item: T, merge?: (a: T, b: T) => T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const out = list.slice();
  out[i] = merge ? merge(list[i], item) : item;
  return out;
}

export function toSnapshot(raw: Record<string, unknown> | null | undefined): HostedSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = emptySnapshot();
  const meta: SharedMeta = {};
  for (const [k, v] of Object.entries(raw)) {
    if ((RECORD_KEYS as readonly string[]).includes(k)) (s as unknown as Record<string, unknown>)[k] = Array.isArray(v) ? v : [];
    else meta[k] = v;
  }
  s.meta = meta;
  return s;
}

export function fromSnapshot(s: HostedSnapshot): Record<string, unknown> {
  return { ...s.meta, mothers: s.mothers, overrides: s.overrides, proposals: s.proposals, learnedRules: s.learnedRules, outbound: s.outbound, inbound: s.inbound };
}

class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  private store: SnapshotStore;
  private kv: KV;
  private snap: HostedSnapshot = emptySnapshot();
  private loaded = false;
  private loading?: Promise<HostedSnapshot | null>;
  private listeners = new Listeners<BackendUpdate>();
  private notes: BackendNote[] = [];
  private updates: MessageStatusUpdate[] = [];
  private changed = new Set<string>();
  private changedAll = false;
  private scheduled = false;
  private saving: Promise<unknown> = Promise.resolve();
  private cancels = new Set<() => void>();
  private fallbackReason?: string;
  private identityPatch?: Partial<Identity>;
  private lastSavedAt?: string;

  constructor(store: SnapshotStore, kv: KV, o: LocalBackendOptions) {
    this.store = store;
    this.kv = kv;
    this.fallbackReason = o.fallbackReason;
    this.identityPatch = o.identity;
    if (o.fallbackReason) this.notes.push({ id: noteId(), at: new Date().toISOString(), level: 'info', text: o.fallbackReason });
  }

  load(): Promise<HostedSnapshot | null> {
    if (!this.loading)
      this.loading = this.store.load().then(
        (raw) => {
          const s = toSnapshot(raw);
          if (s) this.snap = s;
          this.loaded = true;
          this.changedAll = true;
          this.emit('remote');
          return s && (s.mothers.length || Object.keys(s.meta).length) ? this.snap : null;
        },
        () => {
          this.loaded = true;
          return null;
        },
      );
    return this.loading;
  }

  subscribe(listener: (u: BackendUpdate) => void): () => void {
    const off = this.listeners.add(listener);
    if (this.loaded) {
      this.changedAll = true;
      this.emit('remote');
    }
    return off;
  }

  private emit(origin: 'local' | 'remote' = 'local'): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const u: BackendUpdate = {
        snapshot: this.snap,
        changedMotherIds: this.changedAll ? 'all' : [...this.changed],
        notes: this.notes.splice(0),
        messageUpdates: this.updates.splice(0),
        status: this.status(),
        origin,
      };
      this.changed.clear();
      this.changedAll = false;
      this.listeners.emit(u);
    });
  }

  private async persist(): Promise<void> {
    if (!this.loaded) await this.load();
    const data = fromSnapshot(this.snap);
    this.saving = this.saving.then(() => this.store.save(data)).then(
      () => (this.lastSavedAt = new Date().toISOString()),
      () => this.notes.push({ id: noteId(), at: new Date().toISOString(), level: 'error', text: 'Could not save on this device. Download a backup file now.' }),
    );
    this.emit();
  }

  private patch(fn: (s: HostedSnapshot) => HostedSnapshot, motherId?: string): Promise<void> {
    this.snap = fn(this.snap);
    if (motherId) this.changed.add(motherId);
    else this.changedAll = true;
    return this.persist();
  }

  async appendEvents(motherId: string, events: ClinicalEvent[]): Promise<void> {
    if (!this.snap.mothers.some((m) => m.id === motherId)) await this.load();
    return this.patch((s) => ({ ...s, mothers: s.mothers.map((m) => (m.id === motherId ? { ...m, events: mergeEvents(m.events, events) } : m)) }), motherId);
  }

  saveMother(mother: Mother): Promise<void> {
    return this.patch((s) => {
      const prev = s.mothers.find((m) => m.id === mother.id);
      const merged = prev ? { ...mother, events: mergeEvents(prev.events, mother.events ?? []) } : mother;
      return { ...s, mothers: upsertById(s.mothers, merged) };
    }, mother.id);
  }

  saveOverride(o: Override): Promise<void> {
    return this.patch((s) => ({ ...s, overrides: upsertById(s.overrides, o) }));
  }

  saveProposal(p: RuleProposal): Promise<void> {
    return this.patch((s) => ({ ...s, proposals: upsertById(s.proposals, p) }));
  }

  saveRule(r: LearnedRule): Promise<void> {
    return this.patch((s) => ({ ...s, learnedRules: upsertById(s.learnedRules, r) }));
  }

  saveInbound(m: InboundMessage): Promise<void> {
    return this.patch((s) => ({ ...s, inbound: upsertById(s.inbound, m) }), m.motherId);
  }

  private putOutbound(m: OutboundMessage): Promise<void> {
    return this.patch((s) => ({ ...s, outbound: upsertById(s.outbound, m, (a, b) => ({ ...a, ...b, status: laterStatus(a.status, b.status) })) }), m.motherId);
  }

  async sendMessage(req: SendMessageRequest, opts: SendOptions = {}): Promise<SendMessageResponse> {
    const m = req.message;
    const mother = this.snap.mothers.find((x) => x.id === m.motherId);
    const refusal = refusalFor(req, mother);
    const at = new Date().toISOString();
    if (refusal) {
      const u: MessageStatusUpdate = { messageId: m.id, motherId: m.motherId, status: 'failed', at, reason: refusal, simulated: true };
      return { messageId: m.id, status: 'failed', updates: [u], simulated: true, reason: refusal };
    }
    await this.putOutbound({ ...m, status: 'queued' });
    const cancel = simulateDelivery(m, req.to ?? (m.channel === 'email' ? mother?.email : mother?.phone?.number), (u) => {
      void this.putOutbound({ ...m, status: u.status, sentAt: u.status === 'sent' ? u.at : m.sentAt });
      this.updates.push(u);
      opts.onStatus?.(u);
      this.emit();
    });
    this.cancels.add(cancel);
    return { messageId: m.id, status: 'queued', updates: [{ messageId: m.id, motherId: m.motherId, status: 'queued', at, provider: 'simulated', simulated: true }], simulated: true };
  }

  async aiProxy(_req: AIProxyRequest): Promise<AIProxyResponse> {
    throw new BackendError('unavailable', 'There is no server here. Gaskin uses the AI chosen in settings, or its templates.');
  }

  hasAIProxy(): boolean {
    return false;
  }

  async whoami(): Promise<Identity> {
    const workerId = typeof this.snap.meta.currentWorkerId === 'string' ? this.snap.meta.currentWorkerId : undefined;
    return { userId: workerId ?? 'local', name: 'Health worker on this device', role: 'worker', facilityIds: [], workerId, canWrite: true, source: 'local', ...this.identityPatch };
  }

  saveMeta(patch: SharedMeta): Promise<void> {
    return this.patch((s) => ({ ...s, meta: { ...s.meta, ...patch } }));
  }

  getUserSettings<T = unknown>(key: string): Promise<T | undefined> {
    return this.kv.get<T>(`settings.${key}`);
  }

  setUserSettings(key: string, value: unknown): Promise<void> {
    return this.kv.set(`settings.${key}`, value);
  }

  async importSnapshot(s: HostedSnapshot): Promise<void> {
    this.snap = s;
    this.changedAll = true;
    await this.persist();
    await this.flush();
  }

  async flush(): Promise<void> {
    await this.store.flushNow?.();
    await this.saving;
  }

  status(): BackendStatus {
    const st = this.store.status?.();
    return {
      kind: 'local',
      label: st?.where && st.where !== 'this browser' ? `This device only (${st.where})` : 'This device only',
      online: false,
      pending: 0,
      lastSyncAt: st?.savedAt ?? this.lastSavedAt,
      stale: false,
      fallbackReason: this.fallbackReason,
    };
  }

  close(): void {
    for (const c of this.cancels) c();
  }
}

export async function createLocalBackend(o: LocalBackendOptions = {}): Promise<Backend> {
  const store = o.store ?? ((await getAppStore<Record<string, unknown>>()) as SnapshotStore);
  const kv = o.kv ?? (await openKV('gaskin.local.'));
  return new LocalBackend(store, kv, o);
}
