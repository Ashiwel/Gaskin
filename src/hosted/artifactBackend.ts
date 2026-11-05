/**
 * Hosted demo backend on the claude.ai artifact `db` capability: shared,
 * live and durable, so everyone who opens the demo link sees the same
 * mothers, and a change made on one phone appears on the other in seconds.
 *
 * Document layout (all plain JSON, each well under the 256 KiB limit):
 *
 *   mothers/<motherId>            { schema, profile, events[], rev, baseRev, updatedBy, updatedAt, chunks? }
 *   mothers/<motherId>/events/cN  { events[] }   only when her timeline outgrows one document
 *   messages/<motherId>           { outbound[], inbound[], updatedAt }   all of one mother's messages
 *   overrides/<overrideId>        Override
 *   proposals/<proposalId>        RuleProposal
 *   rules/<ruleId>                LearnedRule
 *   meta/demo                     { clock, libraryVersion, ... }   shared demo settings
 *   data/users/<viewerId>/settings { values: { key: value } }   private to each viewer
 *
 * One document per mother keeps the count low (37 synthetic mothers make
 * about 80 documents; the store allows 25,000) and makes "last writer wins
 * per mother" the natural unit of conflict.
 *
 * Writes are debounced (one write per mother per pause, one write at a time
 * per document). Before writing, the backend takes a short cooperative lease
 * on the document, reads the newest version and merges: clinical events are
 * a union by id (never lost), messages merge by id with delivery status only
 * moving forward, and the mother's profile fields are last-writer-wins. If
 * another person's write replaced ours anyway, the snapshot shows it: the
 * backend re-appends any events of ours that went missing and raises a
 * visible note.
 *
 * Fallbacks. If `claude.use('db')` resolves null (opened as a file, signed
 * out, or not granted), the page runs on this device only (localBackend). If
 * the viewer may read but not write the shared data (a Viewer, or an outside
 * reviewer on a public link), their changes stay in this browser as an
 * overlay on top of the live shared data, with a note saying so.
 *
 * The page must declare (see ARTIFACT_CAPABILITIES):
 *   db: rules [ {path:'', read:'view', write:'interact'},
 *               {path:'rules', read:'view', write:'admin'},
 *               {path:'data/users/{self}', read:'interact', write:'interact'} ]
 *   user: { scopes: ['profile'] }
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
  noteId,
} from './backend';
import type { AIProxyRequest, AIProxyResponse, Identity, MessageStatusUpdate, MotherProfile, SendMessageRequest, SendMessageResponse } from './syncTypes';
import { laterStatus, mergeEvents, randomId, splitMother } from './syncTypes';
import { type RtDB, type RtDbError, type RtDocRef, type RtQuerySnapshot, type RtUser, type RtClaude, safeSegment, requestCapability, artifactRuntime } from './runtime';
import { openKV, type KV } from './kv';
import { refusalFor, simulateDelivery } from './simulate';
import { createLocalBackend } from './localBackend';

/** Pass these as `capabilities` when publishing the hosted demo */
export const ARTIFACT_CAPABILITIES = {
  db: {
    rules: [
      { path: '', read: 'view', write: 'interact' },
      { path: 'rules', read: 'view', write: 'admin' },
      { path: 'data/users/{self}', read: 'interact', write: 'interact' },
    ],
  },
  user: { scopes: ['profile'] },
  sample: {},
  downloads: true,
} as const;

const SCHEMA = 1;
/** Keep a mother document well below the 256 KiB cap; older events move to chunk documents past this */
const INLINE_EVENT_BYTES = 160 * 1024;
const CHUNK_BYTES = 150 * 1024;
const DEBOUNCE_MS = 400;
const MAX_MESSAGES_PER_MOTHER = 300;
const LOAD_TIMEOUT_MS = 10_000;

interface MotherDoc {
  schema: number;
  profile: MotherProfile;
  events: ClinicalEvent[];
  rev: number;
  baseRev: number;
  /** Viewer id plus tab id of the last writer */
  updatedBy: string;
  updatedAt: string;
  chunks?: Array<{ id: string; count: number }>;
  chunkRev?: number;
}

interface MessagesDoc {
  outbound: OutboundMessage[];
  inbound: InboundMessage[];
  updatedAt: string;
}

type DocKind = 'overrides' | 'proposals' | 'rules';

export interface ArtifactBackendOptions {
  /** For tests: a runtime object with `use()` */
  runtime?: RtClaude;
  /** For tests: browser storage replacement */
  kv?: KV;
  debounceMs?: number;
  loadTimeoutMs?: number;
}

function firstName(m: { name?: string } | undefined): string {
  return (m?.name ?? 'This mother').split(/\s+/)[0];
}

function byteLen(v: unknown): number {
  return JSON.stringify(v).length;
}

function mergeById<T extends { id: string }>(a: T[], b: T[], pick: (x: T, y: T) => T = (_x, y) => y): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const y of b) {
    const x = m.get(y.id);
    m.set(y.id, x ? pick(x, y) : y);
  }
  return [...m.values()];
}

function mergeOutbound(x: OutboundMessage, y: OutboundMessage): OutboundMessage {
  const status = laterStatus(x.status, y.status);
  return { ...x, ...y, status, sentAt: y.sentAt ?? x.sentAt };
}

function mergeMessages(a: MessagesDoc | undefined, b: Partial<MessagesDoc>): MessagesDoc {
  const outbound = mergeById(a?.outbound ?? [], b.outbound ?? [], mergeOutbound)
    .sort((p, q) => (p.createdAt < q.createdAt ? -1 : 1))
    .slice(-MAX_MESSAGES_PER_MOTHER);
  const inbound = mergeById(a?.inbound ?? [], b.inbound ?? [])
    .sort((p, q) => (p.receivedAt < q.receivedAt ? -1 : 1))
    .slice(-MAX_MESSAGES_PER_MOTHER);
  return { outbound, inbound, updatedAt: new Date().toISOString() };
}

function isPermissionError(e: unknown): boolean {
  const c = (e as RtDbError)?.code;
  return c === 'invalid_argument' || c === 'not_granted' || c === 'revoked';
}

/** Split a timeline into inline events and older chunks so no document passes the size cap */
export function chunkEvents(events: ClinicalEvent[]): { inline: ClinicalEvent[]; chunks: ClinicalEvent[][] } {
  if (byteLen(events) <= INLINE_EVENT_BYTES) return { inline: events, chunks: [] };
  const inline: ClinicalEvent[] = [];
  let size = 2;
  let i = events.length - 1;
  for (; i >= 0; i--) {
    const s = byteLen(events[i]) + 1;
    if (size + s > INLINE_EVENT_BYTES / 2 && inline.length) break;
    inline.unshift(events[i]);
    size += s;
  }
  const older = events.slice(0, i + 1);
  const chunks: ClinicalEvent[][] = [];
  let cur: ClinicalEvent[] = [];
  let cs = 2;
  for (const e of older) {
    const s = byteLen(e) + 1;
    if (cs + s > CHUNK_BYTES && cur.length) {
      chunks.push(cur);
      cur = [];
      cs = 2;
    }
    cur.push(e);
    cs += s;
  }
  if (cur.length) chunks.push(cur);
  return { inline, chunks };
}

/**
 * The documents a snapshot becomes in the shared store, in the layout above.
 * Used to seed a freshly published demo with ArtifactData batch writes
 * (server/scripts/artifact-seed.ts writes them as JSON files).
 */
export function toArtifactDocs(s: HostedSnapshot, writer = 'seed'): Array<{ collection: string; doc_id: string; data: Record<string, unknown> }> {
  const out: Array<{ collection: string; doc_id: string; data: Record<string, unknown> }> = [];
  const now = new Date().toISOString();
  for (const m of s.mothers) {
    const { profile, events } = splitMother(m);
    const { inline, chunks } = chunkEvents(events);
    const doc: MotherDoc = { schema: SCHEMA, profile, events: inline, rev: 1, baseRev: 0, updatedBy: writer, updatedAt: now };
    if (chunks.length) {
      doc.chunks = chunks.map((c, i) => ({ id: `c${i}`, count: c.length }));
      doc.chunkRev = 1;
      chunks.forEach((c, i) => out.push({ collection: `mothers/${safeSegment(m.id)}/events`, doc_id: `c${i}`, data: { events: c } }));
    }
    out.push({ collection: 'mothers', doc_id: safeSegment(m.id), data: doc as unknown as Record<string, unknown> });
  }
  const byMother = new Map<string, Partial<MessagesDoc>>();
  for (const o of s.outbound) byMother.set(o.motherId, { ...byMother.get(o.motherId), outbound: [...(byMother.get(o.motherId)?.outbound ?? []), o] });
  for (const i of s.inbound) byMother.set(i.motherId, { ...byMother.get(i.motherId), inbound: [...(byMother.get(i.motherId)?.inbound ?? []), i] });
  for (const [id, p] of byMother) out.push({ collection: 'messages', doc_id: safeSegment(id), data: mergeMessages(undefined, p) as unknown as Record<string, unknown> });
  for (const o of s.overrides) out.push({ collection: 'overrides', doc_id: safeSegment(o.id), data: o as unknown as Record<string, unknown> });
  for (const p of s.proposals) out.push({ collection: 'proposals', doc_id: safeSegment(p.id), data: p as unknown as Record<string, unknown> });
  for (const r of s.learnedRules) out.push({ collection: 'rules', doc_id: safeSegment(r.id), data: r as unknown as Record<string, unknown> });
  if (Object.keys(s.meta ?? {}).length) out.push({ collection: 'meta', doc_id: 'demo', data: s.meta });
  return JSON.parse(JSON.stringify(out));
}

class ArtifactBackend implements Backend {
  readonly kind = 'artifact' as const;
  private db: RtDB;
  private user: RtUser | null;
  private kv: KV;
  private viewerId: string | null = null;
  private tabId = randomId('tab-').slice(0, 16);
  private writer = '';
  private listeners = new Listeners<BackendUpdate>();
  private unsubs: Array<() => void> = [];

  // Remote state, as the shared store last delivered it
  private remoteMothers = new Map<string, MotherDoc>();
  private chunkCache = new Map<string, { rev: number; events: ClinicalEvent[] }>();
  private remoteMessages = new Map<string, MessagesDoc>();
  private remoteDocs: Record<DocKind, Map<string, unknown>> = { overrides: new Map(), proposals: new Map(), rules: new Map() };
  private remoteMeta: SharedMeta = {};

  // Local edits not yet confirmed (write-behind), and the read-only overlay
  private pendingMothers = new Map<string, { profile?: MotherProfile; events: ClinicalEvent[] }>();
  private pendingMessages = new Map<string, Partial<MessagesDoc>>();
  private overlay = { mothers: new Map<string, { profile?: MotherProfile; events: ClinicalEvent[] }>(), messages: new Map<string, Partial<MessagesDoc>>(), docs: { overrides: new Map(), proposals: new Map(), rules: new Map() } as Record<DocKind, Map<string, unknown>>, meta: {} as SharedMeta };
  private lastWrittenRev = new Map<string, number>();

  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private queues = new Map<string, Promise<void>>();
  private inflight = 0;
  private cancels = new Set<() => void>();

  private readOnly = false;
  private readOnlyReason?: string;
  private loaded = { mothers: false, messages: false, overrides: false, proposals: false, rules: false, meta: false };
  private confirmed = false;
  private online = true;
  private lastSyncAt?: string;
  private notesQueue: BackendNote[] = [];
  private messageUpdatesQueue: MessageStatusUpdate[] = [];
  private changedQueue = new Set<string>();
  private changedAll = false;
  private emitScheduled = false;
  private debounceMs: number;
  private loadTimeoutMs: number;
  private identity?: Identity;
  private firstLoad?: Promise<void>;
  private resolveFirstLoad?: () => void;
  private loadTimer?: ReturnType<typeof setTimeout>;

  constructor(db: RtDB, user: RtUser | null, kv: KV, o: ArtifactBackendOptions) {
    this.db = db;
    this.user = user;
    this.kv = kv;
    this.debounceMs = o.debounceMs ?? DEBOUNCE_MS;
    this.loadTimeoutMs = o.loadTimeoutMs ?? LOAD_TIMEOUT_MS;
  }

  async init(): Promise<void> {
    this.viewerId = (await this.user?.id().catch(() => null)) ?? null;
    this.writer = `${this.viewerId ?? 'anon'}#${this.tabId}`;
    const canWrite = await this.user?.can('data.write').catch(() => null);
    const saved = await this.kv.get<{ mothers: Array<[string, { profile?: MotherProfile; events: ClinicalEvent[] }]>; messages: Array<[string, Partial<MessagesDoc>]>; docs: Record<DocKind, Array<[string, unknown]>>; meta: SharedMeta }>('artifact.overlay');
    if (saved) {
      this.overlay.mothers = new Map(saved.mothers);
      this.overlay.messages = new Map(saved.messages);
      for (const k of ['overrides', 'proposals', 'rules'] as DocKind[]) this.overlay.docs[k] = new Map(saved.docs?.[k] ?? []);
      this.overlay.meta = saved.meta ?? {};
    }
    if (canWrite === false) this.goReadOnly('You can view the shared demo but not change it, so your changes stay in this browser.');
    this.firstLoad = new Promise((r) => (this.resolveFirstLoad = r));
    this.startListening();
  }

  // ---------- Listening ----------

  private startListening(): void {
    const err = (what: keyof ArtifactBackend['loaded']) => (e: RtDbError) => {
      this.loaded[what] = true;
      this.online = false;
      this.note('warning', `Shared demo data could not be loaded (${e.code}). Showing what this browser has.`);
      this.checkLoaded();
      this.scheduleEmit();
    };
    this.loadTimer = setTimeout(() => {
      if (!this.confirmed) {
        this.online = false;
        this.note('warning', 'The shared demo data is taking a while to arrive. What you see may be out of date.');
        this.resolveFirstLoad?.();
        this.scheduleEmit();
      }
    }, this.loadTimeoutMs);

    this.unsubs.push(
      this.db.collection('mothers').onSnapshot((s) => this.onMothers(s), err('mothers')),
      this.db.collection('messages').onSnapshot((s) => this.onMessages(s), err('messages')),
      this.db.collection('overrides').onSnapshot((s) => this.onDocs('overrides', s), err('overrides')),
      this.db.collection('proposals').onSnapshot((s) => this.onDocs('proposals', s), err('proposals')),
      this.db.collection('rules').onSnapshot((s) => this.onDocs('rules', s), err('rules')),
      this.db.doc('meta/demo').onSnapshot(
        (s) => {
          this.remoteMeta = (s.exists ? (s.data() as SharedMeta) : {}) ?? {};
          this.markLoaded('meta', s.metadata.fromCache);
          this.changedAll = true;
          this.scheduleEmit();
        },
        err('meta'),
      ),
    );
  }

  private markLoaded(what: keyof ArtifactBackend['loaded'], fromCache: boolean): void {
    this.loaded[what] = true;
    if (!fromCache) {
      this.online = true;
      this.lastSyncAt = new Date().toISOString();
    }
    this.checkLoaded(fromCache);
  }

  private checkLoaded(fromCache = true): void {
    if (Object.values(this.loaded).every(Boolean)) {
      if (!fromCache && !this.confirmed) {
        this.confirmed = true;
        clearTimeout(this.loadTimer);
      }
      this.resolveFirstLoad?.();
    }
  }

  private onMothers(s: RtQuerySnapshot): void {
    const seen = new Set<string>();
    for (const d of s.docs) {
      const doc = d.data() as MotherDoc | undefined;
      if (!doc?.profile) continue;
      const id = doc.profile.id;
      seen.add(id);
      const prev = this.remoteMothers.get(id);
      if (prev && prev.rev === doc.rev && prev.updatedBy === doc.updatedBy) continue;
      this.remoteMothers.set(id, doc);
      this.changedQueue.add(id);
      if (doc.chunks?.length) void this.loadChunks(id, doc);
      if (!d.metadata.hasPendingWrites && doc.updatedBy !== this.writer) this.checkConflict(id, prev, doc);
    }
    for (const id of [...this.remoteMothers.keys()]) if (!seen.has(id)) {
      this.remoteMothers.delete(id);
      this.changedQueue.add(id);
    }
    this.markLoaded('mothers', s.metadata.fromCache);
    this.scheduleEmit();
  }

  /** Someone else's write arrived. Did it replace ours, or land while we were editing? */
  private checkConflict(id: string, prev: MotherDoc | undefined, incoming: MotherDoc): void {
    const mine = this.lastWrittenRev.get(id);
    const name = firstName(incoming.profile);
    if (mine != null && incoming.baseRev < mine && incoming.rev >= mine) {
      // They wrote from an older copy: last writer wins, but events are never lost
      const ours = this.oursMissing(id, incoming);
      this.note('warning', `${name}'s record was saved by someone else at the same time as you. Their version is shown${ours.length ? `, and your ${ours.length} new ${ours.length === 1 ? 'entry was' : 'entries were'} added back` : ''}. Check her details.`, id);
      if (ours.length) {
        const p = this.pendingMothers.get(id) ?? { events: [] };
        p.events = mergeEvents(p.events, ours);
        this.pendingMothers.set(id, p);
        this.scheduleWrite(`m:${id}`);
      }
      this.lastWrittenRev.delete(id);
    } else if (prev && this.pendingMothers.get(id)?.profile) {
      this.note('info', `${name}'s record was also changed by someone else while you were editing. Your changes will be saved, and their new entries are kept.`, id);
    }
  }

  /** Events this tab wrote, kept for the session so an overwrite by someone else cannot lose them */
  private writtenEvents = new Map<string, Map<string, ClinicalEvent>>();

  private oursMissing(id: string, incoming: MotherDoc): ClinicalEvent[] {
    const mine = this.writtenEvents.get(id);
    if (!mine?.size) return [];
    const have = new Set(this.allRemoteEvents(id, incoming).map((e) => e.id));
    return [...mine.values()].filter((e) => !have.has(e.id));
  }

  private async loadChunks(id: string, doc: MotherDoc): Promise<void> {
    const cached = this.chunkCache.get(id);
    if (cached && cached.rev === (doc.chunkRev ?? 0)) return;
    try {
      const parts = await Promise.all((doc.chunks ?? []).map((c) => this.db.doc(`mothers/${safeSegment(id)}/events/${c.id}`).get()));
      const events = parts.flatMap((p) => ((p.data() as { events?: ClinicalEvent[] } | undefined)?.events ?? []));
      this.chunkCache.set(id, { rev: doc.chunkRev ?? 0, events });
      this.changedQueue.add(id);
      this.scheduleEmit();
    } catch {
      this.note('warning', `Older entries in ${firstName(doc.profile)}'s timeline could not be loaded yet.`, id);
    }
  }

  private allRemoteEvents(id: string, doc = this.remoteMothers.get(id)): ClinicalEvent[] {
    if (!doc) return [];
    const older = doc.chunks?.length ? (this.chunkCache.get(id)?.events ?? []) : [];
    return older.length ? mergeEvents(older, doc.events ?? []) : (doc.events ?? []);
  }

  private onMessages(s: RtQuerySnapshot): void {
    for (const d of s.docs) {
      const doc = d.data() as MessagesDoc | undefined;
      if (!doc) continue;
      const prev = this.remoteMessages.get(d.id);
      const before = new Map((prev?.outbound ?? []).map((m) => [m.id, m.status]));
      for (const m of doc.outbound ?? []) {
        const was = before.get(m.id);
        if (was && was !== m.status) this.messageUpdatesQueue.push({ messageId: m.id, motherId: m.motherId, status: m.status, at: new Date().toISOString(), provider: 'simulated', simulated: true });
      }
      this.remoteMessages.set(d.id, doc);
    }
    this.markLoaded('messages', s.metadata.fromCache);
    this.changedAll = true;
    this.scheduleEmit();
  }

  private onDocs(kind: DocKind, s: RtQuerySnapshot): void {
    const m = new Map<string, unknown>();
    for (const d of s.docs) {
      const v = d.data() as { id?: string } | undefined;
      if (v) m.set(v.id ?? d.id, v);
    }
    this.remoteDocs[kind] = m;
    this.markLoaded(kind, s.metadata.fromCache);
    this.changedAll = true;
    this.scheduleEmit();
  }

  // ---------- Composing the view ----------

  private composeMother(id: string): Mother | undefined {
    const remote = this.remoteMothers.get(id);
    const pending = this.pendingMothers.get(id);
    const over = this.overlay.mothers.get(id);
    const profile = over?.profile ?? pending?.profile ?? remote?.profile;
    if (!profile) return undefined;
    let events = this.allRemoteEvents(id);
    if (pending?.events.length) events = mergeEvents(events, pending.events);
    if (over?.events.length) events = mergeEvents(events, over.events);
    return { ...profile, events };
  }

  private snapshotNow(): HostedSnapshot {
    const ids = new Set([...this.remoteMothers.keys(), ...this.pendingMothers.keys(), ...this.overlay.mothers.keys()]);
    const mothers = [...ids].map((id) => this.composeMother(id)).filter((m): m is Mother => !!m).sort((a, b) => (a.id < b.id ? -1 : 1));
    const msgIds = new Set([...this.remoteMessages.keys(), ...this.pendingMessages.keys(), ...this.overlay.messages.keys()]);
    const outbound: OutboundMessage[] = [];
    const inbound: InboundMessage[] = [];
    for (const k of msgIds) {
      let doc = this.remoteMessages.get(k);
      const p = this.pendingMessages.get(k);
      if (p) doc = mergeMessages(doc, p);
      const o = this.overlay.messages.get(k);
      if (o) doc = mergeMessages(doc, o);
      outbound.push(...(doc?.outbound ?? []));
      inbound.push(...(doc?.inbound ?? []));
    }
    const docs = <T>(k: DocKind) => [...new Map([...this.remoteDocs[k], ...this.overlay.docs[k]]).values()] as T[];
    return {
      mothers,
      overrides: docs<Override>('overrides'),
      proposals: docs<RuleProposal>('proposals'),
      learnedRules: docs<LearnedRule>('rules'),
      outbound: outbound.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      inbound: inbound.sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1)),
      meta: { ...this.remoteMeta, ...this.overlay.meta },
    };
  }

  private scheduleEmit(origin: 'local' | 'remote' = 'remote'): void {
    if (this.emitScheduled) return;
    this.emitScheduled = true;
    queueMicrotask(() => {
      this.emitScheduled = false;
      const u: BackendUpdate = {
        snapshot: this.snapshotNow(),
        changedMotherIds: this.changedAll ? 'all' : [...this.changedQueue],
        notes: this.notesQueue.splice(0),
        messageUpdates: this.messageUpdatesQueue.splice(0),
        status: this.status(),
        origin,
      };
      this.changedQueue.clear();
      this.changedAll = false;
      this.listeners.emit(u);
    });
  }

  private note(level: BackendNote['level'], text: string, motherId?: string): void {
    this.notesQueue.push({ id: noteId(), at: new Date().toISOString(), level, text, motherId });
  }

  // ---------- Writing ----------

  private goReadOnly(reason: string): void {
    if (this.readOnly) return;
    this.readOnly = true;
    this.readOnlyReason = reason;
    this.note('info', reason);
    // Anything still waiting to be written moves to the local overlay
    for (const [id, p] of this.pendingMothers) {
      const o = this.overlay.mothers.get(id) ?? { events: [] };
      this.overlay.mothers.set(id, { profile: p.profile ?? o.profile, events: mergeEvents(o.events, p.events) });
    }
    this.pendingMothers.clear();
    for (const [id, p] of this.pendingMessages) this.overlay.messages.set(id, mergeMessages(this.overlay.messages.get(id) as MessagesDoc | undefined, p));
    this.pendingMessages.clear();
    void this.saveOverlay();
  }

  private async saveOverlay(): Promise<void> {
    await this.kv.set('artifact.overlay', {
      mothers: [...this.overlay.mothers],
      messages: [...this.overlay.messages],
      docs: { overrides: [...this.overlay.docs.overrides], proposals: [...this.overlay.docs.proposals], rules: [...this.overlay.docs.rules] },
      meta: this.overlay.meta,
    });
  }

  private scheduleWrite(key: string): void {
    clearTimeout(this.timers.get(key));
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.enqueue(key, () => this.writeKey(key));
      }, this.debounceMs),
    );
  }

  /** One write at a time per document */
  private enqueue(key: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.queues.get(key) ?? Promise.resolve();
    this.inflight++;
    const next = prev
      .then(fn)
      .catch((e) => this.writeFailed(key, e))
      .finally(() => {
        this.inflight--;
        if (this.queues.get(key) === next) this.queues.delete(key);
        this.scheduleEmit('local');
      });
    this.queues.set(key, next);
    return next;
  }

  private writeFailed(key: string, e: unknown): void {
    const code = (e as RtDbError)?.code;
    if (isPermissionError(e)) {
      if (key.startsWith('d:rules/')) {
        // Only editors (the clinical reviewer role in the demo) publish rules
        const id = key.slice('d:rules/'.length);
        const v = this.pendingDocs.get(key);
        if (v) this.overlay.docs.rules.set(id, v);
        this.pendingDocs.delete(key);
        this.note('warning', 'Only an editor of this demo (acting as clinical reviewer) can publish approved rules. Your approval is kept in this browser.');
        void this.saveOverlay();
        return;
      }
      this.goReadOnly('You can view the shared demo but not change it, so your changes stay in this browser.');
      return;
    }
    if (code === 'quota_exceeded') {
      this.note('error', 'The shared demo storage is full. Ask the owner to reset the demo; your change is kept in this browser.');
      this.goReadOnly('The shared demo storage is full, so changes stay in this browser.');
      return;
    }
    // unavailable / resource_exhausted: try again shortly
    this.online = false;
    this.note('warning', 'A change could not be saved to the shared demo yet. Gaskin will keep trying.');
    setTimeout(() => this.scheduleWrite(key), 3000 + Math.random() * 2000);
  }

  private async withLease<T>(ref: RtDocRef, fn: () => Promise<T>): Promise<T> {
    const acquire = (ref as RtDocRef & { acquire?: (o: { holder: string; ttlMs?: number }) => Promise<{ acquired: boolean; expiresAt?: string }> }).acquire;
    if (typeof acquire === 'function') {
      for (let i = 0; i < 4; i++) {
        try {
          const r = await acquire.call(ref, { holder: this.writer, ttlMs: 5000 });
          if (r.acquired) break;
          const wait = r.expiresAt ? Math.min(2000, Math.max(100, Date.parse(r.expiresAt) - Date.now())) : 300;
          await new Promise((res) => setTimeout(res, wait + Math.random() * 100));
        } catch {
          break; // leases are cooperative: write anyway, the merge and the snapshot check still protect events
        }
      }
    }
    return fn();
  }

  private pendingDocs = new Map<string, unknown>();

  private async writeKey(key: string): Promise<void> {
    if (this.readOnly) return;
    if (key.startsWith('m:')) return this.writeMother(key.slice(2));
    if (key.startsWith('msg:')) return this.writeMessages(key.slice(4));
    if (key.startsWith('d:')) {
      const v = this.pendingDocs.get(key);
      if (v === undefined) return;
      await this.db.doc(key.slice(2)).set(JSON.parse(JSON.stringify(v)));
      this.pendingDocs.delete(key);
      return;
    }
    if (key === 'meta') {
      const patch = this.pendingMeta;
      this.pendingMeta = {};
      const ref = this.db.doc('meta/demo');
      const cur = await ref.get();
      await ref.set({ ...((cur.exists ? cur.data() : {}) as object), ...patch });
    }
  }

  private async writeMother(id: string): Promise<void> {
    const pending = this.pendingMothers.get(id);
    if (!pending) return;
    // Take ownership of what we are about to write; new edits arriving meanwhile go into a fresh entry
    this.pendingMothers.delete(id);
    const ref = this.db.doc(`mothers/${safeSegment(id)}`);
    try {
      await this.withLease(ref, async () => {
        const snap = await ref.get();
        const cur = snap.exists ? (snap.data() as unknown as MotherDoc) : undefined;
        if (cur?.chunks?.length) await this.loadChunks(id, cur);
        const remoteEvents = cur ? this.allRemoteEvents(id, cur) : [];
        const events = mergeEvents(remoteEvents, pending.events);
        const profile = pending.profile ?? cur?.profile;
        if (!profile) throw Object.assign(new Error('missing profile'), { code: 'invalid_argument_local' });
        const rev = (cur?.rev ?? 0) + 1;
        const { inline, chunks } = chunkEvents(events);
        const doc: MotherDoc = { schema: SCHEMA, profile, events: inline, rev, baseRev: cur?.rev ?? 0, updatedBy: this.writer, updatedAt: new Date().toISOString() };
        if (chunks.length) {
          const chunkRev = (cur?.chunkRev ?? 0) + 1;
          doc.chunks = chunks.map((c, i) => ({ id: `c${i}`, count: c.length }));
          doc.chunkRev = chunkRev;
          for (const [i, c] of chunks.entries()) await this.db.doc(`mothers/${safeSegment(id)}/events/c${i}`).set({ events: JSON.parse(JSON.stringify(c)) });
          this.chunkCache.set(id, { rev: chunkRev, events: chunks.flat() });
        }
        await ref.set(JSON.parse(JSON.stringify(doc)));
        this.lastWrittenRev.set(id, rev);
        const mineNow = this.writtenEvents.get(id) ?? new Map<string, ClinicalEvent>();
        for (const e of pending.events) mineNow.set(e.id, e);
        this.writtenEvents.set(id, mineNow);
        this.remoteMothers.set(id, doc);
        this.changedQueue.add(id);
      });
    } catch (e) {
      // Put the edit back so nothing is lost, merged with anything newer
      const now = this.pendingMothers.get(id);
      this.pendingMothers.set(id, { profile: now?.profile ?? pending.profile, events: mergeEvents(pending.events, now?.events ?? []) });
      if ((e as { code?: string }).code === 'invalid_argument_local') {
        this.pendingMothers.delete(id);
        this.note('error', 'An entry was saved for a mother who is not registered in the shared demo. Register her first.', id);
        return;
      }
      throw e;
    }
  }

  private async writeMessages(motherId: string): Promise<void> {
    const pending = this.pendingMessages.get(motherId);
    if (!pending) return;
    this.pendingMessages.delete(motherId);
    const ref = this.db.doc(`messages/${safeSegment(motherId)}`);
    try {
      await this.withLease(ref, async () => {
        const snap = await ref.get();
        const merged = mergeMessages(snap.exists ? (snap.data() as unknown as MessagesDoc) : undefined, pending);
        await ref.set(JSON.parse(JSON.stringify(merged)));
        this.remoteMessages.set(safeSegment(motherId), merged);
      });
    } catch (e) {
      const now = this.pendingMessages.get(motherId);
      this.pendingMessages.set(motherId, now ? mergeMessages(pending as MessagesDoc, now) : pending);
      throw e;
    }
  }

  private pendingMeta: SharedMeta = {};

  // ---------- Backend API ----------

  async load(): Promise<HostedSnapshot | null> {
    await this.firstLoad;
    const s = this.snapshotNow();
    return s.mothers.length || s.proposals.length || s.overrides.length ? s : null;
  }

  subscribe(listener: (u: BackendUpdate) => void): () => void {
    const off = this.listeners.add(listener);
    if (Object.values(this.loaded).some(Boolean)) {
      this.changedAll = true;
      this.scheduleEmit();
    }
    return off;
  }

  async appendEvents(motherId: string, events: ClinicalEvent[]): Promise<void> {
    if (!events.length) return;
    if (this.readOnly) {
      const o = this.overlay.mothers.get(motherId) ?? { events: [] };
      o.events = mergeEvents(o.events, events);
      this.overlay.mothers.set(motherId, o);
      void this.saveOverlay();
    } else {
      const p = this.pendingMothers.get(motherId) ?? { events: [] };
      p.events = mergeEvents(p.events, events);
      this.pendingMothers.set(motherId, p);
      this.scheduleWrite(`m:${motherId}`);
    }
    this.changedQueue.add(motherId);
    this.scheduleEmit('local');
  }

  async saveMother(mother: Mother): Promise<void> {
    const { profile, events } = splitMother(mother);
    if (this.readOnly) {
      const o = this.overlay.mothers.get(mother.id) ?? { events: [] };
      this.overlay.mothers.set(mother.id, { profile, events: mergeEvents(o.events, events.filter((e) => !this.hasRemoteEvent(mother.id, e.id))) });
      void this.saveOverlay();
    } else {
      const p = this.pendingMothers.get(mother.id) ?? { events: [] };
      // Only events the shared copy does not have yet need writing
      const fresh = events.filter((e) => !this.hasRemoteEvent(mother.id, e.id));
      this.pendingMothers.set(mother.id, { profile, events: mergeEvents(p.events, fresh) });
      this.scheduleWrite(`m:${mother.id}`);
    }
    this.changedQueue.add(mother.id);
    this.scheduleEmit('local');
  }

  private hasRemoteEvent(motherId: string, eventId: string): boolean {
    return this.allRemoteEvents(motherId).some((e) => e.id === eventId);
  }

  private saveDocKind(kind: DocKind, id: string, value: unknown): Promise<void> {
    if (this.readOnly) {
      this.overlay.docs[kind].set(id, value);
      void this.saveOverlay();
    } else {
      const key = `d:${kind}/${safeSegment(id)}`;
      this.pendingDocs.set(key, value);
      this.remoteDocs[kind].set(id, value); // optimistic
      this.scheduleWrite(key);
    }
    this.changedAll = true;
    this.scheduleEmit('local');
    return Promise.resolve();
  }

  saveOverride(o: Override): Promise<void> {
    return this.saveDocKind('overrides', o.id, o);
  }

  saveProposal(p: RuleProposal): Promise<void> {
    return this.saveDocKind('proposals', p.id, p);
  }

  saveRule(r: LearnedRule): Promise<void> {
    return this.saveDocKind('rules', r.id, r);
  }

  private putMessages(motherId: string, patch: Partial<MessagesDoc>): void {
    if (this.readOnly) {
      this.overlay.messages.set(motherId, mergeMessages(this.overlay.messages.get(motherId) as MessagesDoc | undefined, patch));
      void this.saveOverlay();
    } else {
      const cur = this.pendingMessages.get(motherId);
      this.pendingMessages.set(motherId, cur ? mergeMessages(cur as MessagesDoc, patch) : patch);
      this.scheduleWrite(`msg:${motherId}`);
    }
    this.changedQueue.add(motherId);
    this.scheduleEmit('local');
  }

  async saveInbound(message: InboundMessage): Promise<void> {
    this.putMessages(message.motherId, { inbound: [message] });
  }

  async sendMessage(req: SendMessageRequest, opts: SendOptions = {}): Promise<SendMessageResponse> {
    const m = req.message;
    const mother = this.composeMother(m.motherId);
    const refusal = refusalFor(req, mother);
    const at = new Date().toISOString();
    if (refusal) {
      const u: MessageStatusUpdate = { messageId: m.id, motherId: m.motherId, status: 'failed', at, reason: refusal, simulated: true };
      return { messageId: m.id, status: 'failed', updates: [u], simulated: true, reason: refusal };
    }
    this.putMessages(m.motherId, { outbound: [{ ...m, status: 'queued' }] });
    const first: MessageStatusUpdate = { messageId: m.id, motherId: m.motherId, status: 'queued', at, provider: 'simulated', simulated: true };
    const cancel = simulateDelivery(m, req.to ?? (m.channel === 'email' ? mother?.email : mother?.phone?.number), (u) => {
      this.putMessages(m.motherId, { outbound: [{ ...m, status: u.status, sentAt: u.status === 'sent' ? u.at : m.sentAt }] });
      this.messageUpdatesQueue.push(u);
      opts.onStatus?.(u);
      this.scheduleEmit('local');
    });
    this.cancels.add(cancel);
    return { messageId: m.id, status: 'queued', updates: [first], simulated: true };
  }

  async aiProxy(_req: AIProxyRequest): Promise<AIProxyResponse> {
    throw new BackendError('unavailable', 'The hosted demo has no AI proxy; Gaskin uses Claude here or its templates.');
  }

  hasAIProxy(): boolean {
    return false;
  }

  async whoami(): Promise<Identity> {
    if (this.identity) return this.identity;
    const me = await this.user?.me().catch(() => null);
    const canEdit = me?.canEdit ?? false;
    this.identity = {
      userId: this.viewerId ?? `guest-${this.tabId}`,
      name: me?.name || 'Demo health worker',
      role: canEdit ? 'clinical_reviewer' : 'worker',
      facilityIds: [],
      canWrite: !this.readOnly,
      source: 'artifact',
    };
    return this.identity;
  }

  async saveMeta(patch: SharedMeta): Promise<void> {
    if (this.readOnly) {
      this.overlay.meta = { ...this.overlay.meta, ...patch };
      void this.saveOverlay();
    } else {
      this.pendingMeta = { ...this.pendingMeta, ...patch };
      this.remoteMeta = { ...this.remoteMeta, ...patch };
      this.scheduleWrite('meta');
    }
    this.changedAll = true;
    this.scheduleEmit('local');
  }

  private settingsRef(): RtDocRef | null {
    return this.viewerId ? this.db.doc(`data/users/${this.viewerId}/settings`) : null;
  }

  async getUserSettings<T = unknown>(key: string): Promise<T | undefined> {
    const ref = this.settingsRef();
    if (ref) {
      try {
        const s = await ref.get();
        const v = (s.data() as { values?: Record<string, unknown> } | undefined)?.values?.[key];
        if (v !== undefined) return v as T;
      } catch {
        /* fall through to this browser */
      }
    }
    return this.kv.get<T>(`settings.${key}`);
  }

  async setUserSettings(key: string, value: unknown): Promise<void> {
    await this.kv.set(`settings.${key}`, value);
    const ref = this.settingsRef();
    if (!ref) return;
    await this.enqueue('settings', async () => {
      const s = await ref.get();
      const values = { ...((s.data() as { values?: Record<string, unknown> } | undefined)?.values ?? {}), [key]: value ?? null };
      await ref.set({ values: JSON.parse(JSON.stringify(values)) });
    }).catch(() => undefined);
  }

  async importSnapshot(s: HostedSnapshot): Promise<void> {
    for (const m of s.mothers) await this.saveMother(m);
    for (const o of s.overrides) await this.saveOverride(o);
    for (const p of s.proposals) await this.saveProposal(p);
    for (const r of s.learnedRules) await this.saveRule(r);
    const byMother = new Map<string, Partial<MessagesDoc>>();
    for (const o of s.outbound) byMother.set(o.motherId, { ...byMother.get(o.motherId), outbound: [...(byMother.get(o.motherId)?.outbound ?? []), o] });
    for (const i of s.inbound) byMother.set(i.motherId, { ...byMother.get(i.motherId), inbound: [...(byMother.get(i.motherId)?.inbound ?? []), i] });
    for (const [id, patch] of byMother) this.putMessages(id, patch);
    if (Object.keys(s.meta ?? {}).length) await this.saveMeta(s.meta);
    await this.flush();
  }

  async flush(): Promise<void> {
    for (const [key, t] of [...this.timers]) {
      clearTimeout(t);
      this.timers.delete(key);
      void this.enqueue(key, () => this.writeKey(key));
    }
    await Promise.all([...this.queues.values()]);
  }

  status(): BackendStatus {
    return {
      kind: 'artifact',
      label: this.readOnly ? 'Shared demo (view only: your changes stay in this browser)' : 'Shared demo workspace',
      online: this.online,
      pending: this.pendingMothers.size + this.pendingMessages.size + this.pendingDocs.size + this.timers.size + this.inflight,
      lastSyncAt: this.lastSyncAt,
      stale: !this.confirmed,
      fallbackReason: this.readOnly ? this.readOnlyReason : undefined,
    };
  }

  close(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    for (const c of this.cancels) c();
    for (const t of this.timers.values()) clearTimeout(t);
    clearTimeout(this.loadTimer);
  }
}

/**
 * Create the artifact backend. Resolves a localBackend (with `fallbackReason`
 * in its status) when the shared store is not available in this view.
 */
export async function createArtifactBackend(o: ArtifactBackendOptions = {}): Promise<Backend> {
  const rt = o.runtime ?? artifactRuntime();
  const [db, user] = await Promise.all([requestCapability<RtDB>('db', 10_000, rt), requestCapability<RtUser>('user', 10_000, rt)]);
  const kv = o.kv ?? (await openKV('gaskin.artifact.'));
  if (!db) {
    return createLocalBackend({
      kv,
      fallbackReason: rt
        ? 'Shared demo storage is not available here (signed out, or not allowed), so changes stay on this device.'
        : 'This copy is running on its own, so changes stay on this device.',
    });
  }
  const b = new ArtifactBackend(db, user, kv, o);
  await b.init();
  return b;
}
