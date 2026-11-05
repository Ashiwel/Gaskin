/**
 * Backend for the production Gaskin server (server/). Offline first:
 *
 *  - Every change is applied to the local copy at once and queued in an
 *    outbox (kept in IndexedDB, so it survives a closed tab or a flat
 *    battery). Each queued op has a unique opId, so a retry after a dropped
 *    2G connection never writes twice.
 *  - A sync loop uploads the outbox with the last cursor and applies the
 *    changes other devices made. It runs after each change (debounced),
 *    every 30 s while online, when the browser comes back online, and when
 *    the server nudges through /api/events.
 *  - Messages and AI calls need the server: they go straight through, and
 *    a message is queued as a 'message' op when offline so the record is
 *    not lost (the worker is told to send by phone if it is urgent).
 *
 * Sign-in is phone number + PIN (POST /api/auth/login). The session token is
 * kept in browser storage for TOKEN_DAYS (30 by default); on a shared
 * facility phone, sign out after each shift.
 */
import type { ClinicalEvent, InboundMessage, LearnedRule, Mother, OutboundMessage, Override, RuleProposal } from '../types';
import {
  type AIProxyCallOptions,
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
import type {
  AIProxyRequest,
  AIProxyResponse,
  ChangeRow,
  Identity,
  LoginResponse,
  MessageStatusUpdate,
  MotherProfile,
  SendMessageRequest,
  SendMessageResponse,
  SyncOp,
  SyncResponse,
} from './syncTypes';
import { laterStatus, mergeEvents, randomId, splitMother } from './syncTypes';
import { openKV, readLocal, writeLocal, type KV } from './kv';

export const SERVER_URL_KEY = 'gaskin.serverUrl';
const TOKEN_KEY = 'gaskin.session';
const DEVICE_KEY = 'gaskin.deviceId';

type FetchFn = typeof fetch;

export interface HttpBackendOptions {
  baseUrl: string;
  /** Session token; defaults to the one saved by login() */
  token?: string;
  fetch?: FetchFn;
  kv?: KV;
  deviceId?: string;
  /** ms between background syncs while online (default 30 s) */
  pollMs?: number;
  /** ms to wait after a change before syncing (default 800) */
  debounceMs?: number;
  /** Use /api/events for live nudges (default true in browsers with EventSource) */
  live?: boolean;
}

interface Persisted {
  cursor: number;
  snap: HostedSnapshot;
  outbox: SyncOp[];
  /** When each mother's record was last confirmed by the server (for conflict detection) */
  confirmedAt: Record<string, string>;
}

function trim(u: string): string {
  return u.replace(/\/+$/, '');
}

export function getDeviceId(): string {
  let id = readLocal(DEVICE_KEY);
  if (!id) {
    id = randomId('dev-');
    writeLocal(DEVICE_KEY, id);
  }
  return id;
}

/** Sign in with phone and PIN. Saves the session for createHttpBackend. Throws BackendError with a plain-English message. */
export async function login(baseUrl: string, phone: string, pin: string, opts: { fetch?: FetchFn; deviceName?: string } = {}): Promise<LoginResponse> {
  const f = opts.fetch ?? fetch.bind(globalThis);
  let res: Response;
  try {
    res = await f(`${trim(baseUrl)}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin, deviceId: getDeviceId(), deviceName: opts.deviceName ?? (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) : 'device') }),
    });
  } catch {
    throw new BackendError('offline', 'Could not reach the Gaskin server. Check the internet connection and try again.');
  }
  const j = (await res.json().catch(() => ({}))) as Partial<LoginResponse> & { message?: string; error?: string };
  if (!res.ok || !j.token) throw new BackendError(res.status === 401 || res.status === 423 ? 'unauthorised' : 'server', j.message ?? 'Sign-in failed.');
  writeLocal(TOKEN_KEY, JSON.stringify({ baseUrl: trim(baseUrl), token: j.token, expiresAt: j.expiresAt, user: j.user }));
  writeLocal(SERVER_URL_KEY, trim(baseUrl));
  return j as LoginResponse;
}

export function savedSession(): { baseUrl: string; token: string; expiresAt?: string; user?: Identity } | null {
  try {
    const s = JSON.parse(readLocal(TOKEN_KEY) ?? 'null') as { baseUrl: string; token: string; expiresAt?: string; user?: Identity } | null;
    if (!s?.token) return null;
    if (s.expiresAt && Date.parse(s.expiresAt) < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  writeLocal(TOKEN_KEY, null);
}

function applyMessageStatus(list: OutboundMessage[], u: MessageStatusUpdate): OutboundMessage[] {
  return list.map((m) => (m.id === u.messageId ? { ...m, status: laterStatus(m.status, u.status), sentAt: u.status === 'sent' ? u.at : m.sentAt } : m));
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const out = list.slice();
  out[i] = item;
  return out;
}

class HttpBackend implements Backend {
  readonly kind = 'http' as const;
  private base: string;
  private token: string;
  private f: FetchFn;
  private kv: KV;
  private deviceId: string;
  private state: Persisted = { cursor: 0, snap: emptySnapshot(), outbox: [], confirmedAt: {} };
  private listeners = new Listeners<BackendUpdate>();
  private notes: BackendNote[] = [];
  private updates: MessageStatusUpdate[] = [];
  private changed = new Set<string>();
  private changedAll = false;
  private scheduled = false;
  private online = true;
  private lastSyncAt?: string;
  private syncing: Promise<void> | null = null;
  private again = false;
  private timer?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setInterval>;
  private es?: EventSource;
  private identity?: Identity;
  private aiEnabled = false;
  private pollMs: number;
  private debounceMs: number;
  private live: boolean;
  private statusWaiters = new Map<string, (u: MessageStatusUpdate) => void>();
  private loadedOnce = false;
  private persistTimer?: ReturnType<typeof setTimeout>;
  private onOnline = () => this.syncSoon(0);

  constructor(o: HttpBackendOptions & { token: string }, kv: KV) {
    this.base = trim(o.baseUrl);
    this.token = o.token;
    this.f = o.fetch ?? fetch.bind(globalThis);
    this.kv = kv;
    this.deviceId = o.deviceId ?? getDeviceId();
    this.pollMs = o.pollMs ?? 30_000;
    this.debounceMs = o.debounceMs ?? 800;
    this.live = o.live ?? typeof EventSource !== 'undefined';
  }

  // ---------- HTTP ----------

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await this.f(`${this.base}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}`, 'X-Device-Id': this.deviceId, ...(init.headers ?? {}) },
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') throw e;
      this.setOnline(false);
      throw new BackendError('offline', 'No connection to the Gaskin server. Your changes are saved on this phone and will sync later.');
    }
    this.setOnline(true);
    if (res.status === 401) {
      clearSession();
      throw new BackendError('unauthorised', 'Your session has ended. Please sign in again.');
    }
    const j = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
    if (!res.ok) {
      const code = res.status === 403 ? 'forbidden' : res.status === 400 || res.status === 422 ? 'invalid' : res.status === 503 ? 'unavailable' : 'server';
      const err = new BackendError(code, j.message ?? `The server returned HTTP ${res.status}.`);
      (err as BackendError & { serverCode?: string }).serverCode = j.error;
      throw err;
    }
    return j;
  }

  private setOnline(v: boolean): void {
    if (this.online === v) return;
    this.online = v;
    this.note(v ? 'info' : 'warning', v ? 'Back online. Syncing your changes.' : 'Offline. Changes are saved on this phone and will sync when the connection returns.');
    this.emit('remote');
  }

  // ---------- Lifecycle ----------

  async init(): Promise<void> {
    const saved = await this.kv.get<Persisted>(`state.${this.base}`);
    if (saved?.snap) this.state = { ...saved, confirmedAt: saved.confirmedAt ?? {} };
    if (typeof window !== 'undefined') window.addEventListener?.('online', this.onOnline);
    this.poll = setInterval(() => this.syncSoon(0), this.pollMs);
    void this.api<{ ai: { enabled: boolean } }>('/api/config')
      .then((c) => (this.aiEnabled = !!c.ai?.enabled))
      .catch(() => undefined);
    this.openLive();
  }

  private openLive(): void {
    if (!this.live || typeof EventSource === 'undefined') return;
    try {
      this.es = new EventSource(`${this.base}/api/events?token=${encodeURIComponent(this.token)}`);
      this.es.addEventListener('changes', () => this.syncSoon(200));
      this.es.addEventListener('message', (e) => {
        try {
          this.applyStatus(JSON.parse((e as MessageEvent).data) as MessageStatusUpdate);
          this.emit('remote');
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* polling still works */
    }
  }

  private persistSoon(): void {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.kv.set(`state.${this.base}`, this.state), 300);
  }

  private async persistNow(): Promise<void> {
    clearTimeout(this.persistTimer);
    await this.kv.set(`state.${this.base}`, this.state);
  }

  // ---------- Emitting ----------

  private note(level: BackendNote['level'], text: string, motherId?: string): void {
    this.notes.push({ id: noteId(), at: new Date().toISOString(), level, text, motherId });
  }

  private emit(origin: 'local' | 'remote' = 'local'): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const u: BackendUpdate = {
        snapshot: this.state.snap,
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

  // ---------- Sync ----------

  private syncSoon(ms = this.debounceMs): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync().catch(() => undefined), ms);
  }

  /** Upload the outbox and pull others' changes until caught up */
  sync(): Promise<void> {
    if (this.syncing) {
      this.again = true;
      return this.syncing;
    }
    this.syncing = (async () => {
      try {
        do {
          this.again = false;
          let more = true;
          let rounds = 0;
          while (more && rounds++ < 50) {
            const ops = this.state.outbox.slice(0, 200);
            const r = await this.api<SyncResponse>('/api/sync', { method: 'POST', body: JSON.stringify({ deviceId: this.deviceId, cursor: this.state.cursor, ops }) });
            if (r.reset) {
              await this.reloadSnapshot();
              break;
            }
            const done = new Set([...r.accepted, ...r.duplicates, ...r.rejected.map((x) => x.opId)]);
            this.state.outbox = this.state.outbox.filter((o) => !done.has(o.opId));
            for (const rej of r.rejected) this.note('error', `A change was not accepted by the server: ${rej.reason}`);
            for (const c of r.conflicts ?? []) this.note('warning', c.note, c.kind === 'mother' ? c.entityId : undefined);
            for (const a of r.alerts ?? []) {
              const name = this.state.snap.mothers.find((m) => m.id === a.motherId)?.name.split(' ')[0] ?? 'A mother';
              this.note(a.level === 'emergency' ? 'error' : 'warning', `${name}: ${a.titles.join('; ')}`, a.motherId);
            }
            for (const ch of r.changes) this.applyChange(ch);
            // Our own accepted mother records are now confirmed at the server's time
            for (const op of ops) if (done.has(op.opId) && op.kind === 'mother') this.state.confirmedAt[op.mother.id] = r.serverTime;
            this.state.cursor = r.cursor;
            more = r.more || this.state.outbox.length > 0;
            this.lastSyncAt = r.serverTime;
          }
        } while (this.again);
        await this.persistNow();
      } finally {
        this.syncing = null;
        this.emit('remote');
      }
    })();
    return this.syncing;
  }

  private async reloadSnapshot(): Promise<void> {
    const s = await this.api<HostedSnapshot & { cursor: number }>('/api/snapshot');
    const local = this.state.snap;
    const { cursor, ...rest } = s;
    // Keep local edits still in the outbox on top of the fresh copy
    this.state.snap = { ...emptySnapshot(), ...rest, meta: local.meta };
    this.state.cursor = cursor;
    const now = new Date().toISOString();
    for (const m of this.state.snap.mothers) this.state.confirmedAt[m.id] = now;
    for (const op of this.state.outbox) this.applyOpLocally(op);
    this.changedAll = true;
  }

  private applyChange(ch: ChangeRow): void {
    const s = this.state.snap;
    switch (ch.kind) {
      case 'mother': {
        const p = ch.body as MotherProfile;
        const prev = s.mothers.find((m) => m.id === p.id);
        s.mothers = upsert(s.mothers, { ...p, events: prev?.events ?? [] });
        this.state.confirmedAt[p.id] = ch.at;
        this.changed.add(p.id);
        break;
      }
      case 'event': {
        const { motherId, event } = ch.body as { motherId: string; event: ClinicalEvent };
        s.mothers = s.mothers.map((m) => (m.id === motherId ? { ...m, events: mergeEvents(m.events, [event]) } : m));
        this.changed.add(motherId);
        break;
      }
      case 'override':
        s.overrides = upsert(s.overrides, ch.body as Override);
        this.changedAll = true;
        break;
      case 'proposal':
        s.proposals = upsert(s.proposals, ch.body as RuleProposal);
        this.changedAll = true;
        break;
      case 'rule':
        s.learnedRules = upsert(s.learnedRules, ch.body as LearnedRule);
        this.changedAll = true;
        break;
      case 'message': {
        const m = ch.body as OutboundMessage;
        const prev = s.outbound.find((x) => x.id === m.id);
        s.outbound = upsert(s.outbound, prev ? { ...m, status: laterStatus(prev.status, m.status) } : m);
        this.changed.add(m.motherId);
        break;
      }
      case 'inbound': {
        const m = ch.body as InboundMessage;
        s.inbound = upsert(s.inbound, m);
        this.changed.add(m.motherId);
        break;
      }
      case 'messageStatus':
        this.applyStatus(ch.body as MessageStatusUpdate);
        break;
    }
  }

  private applyStatus(u: MessageStatusUpdate): void {
    const s = this.state.snap;
    const before = s.outbound.find((m) => m.id === u.messageId)?.status;
    s.outbound = applyMessageStatus(s.outbound, u);
    if (before !== s.outbound.find((m) => m.id === u.messageId)?.status) {
      this.updates.push(u);
      if (u.motherId) this.changed.add(u.motherId);
    }
    this.statusWaiters.get(u.messageId)?.(u);
  }

  private applyOpLocally(op: SyncOp): void {
    const s = this.state.snap;
    switch (op.kind) {
      case 'mother': {
        const prev = s.mothers.find((m) => m.id === op.mother.id);
        s.mothers = upsert(s.mothers, { ...op.mother, events: prev?.events ?? [] });
        this.changed.add(op.mother.id);
        break;
      }
      case 'event':
        s.mothers = s.mothers.map((m) => (m.id === op.motherId ? { ...m, events: mergeEvents(m.events, [op.event]) } : m));
        this.changed.add(op.motherId);
        break;
      case 'override':
        s.overrides = upsert(s.overrides, op.override);
        this.changedAll = true;
        break;
      case 'proposal':
        s.proposals = upsert(s.proposals, op.proposal);
        this.changedAll = true;
        break;
      case 'rule':
        s.learnedRules = upsert(s.learnedRules, op.rule);
        this.changedAll = true;
        break;
      case 'message':
        s.outbound = upsert(s.outbound, op.message);
        this.changed.add(op.message.motherId);
        break;
      case 'inbound':
        s.inbound = upsert(s.inbound, op.message);
        this.changed.add(op.message.motherId);
        break;
    }
  }

  private queue(...ops: SyncOp[]): Promise<void> {
    for (const op of ops) {
      this.state.outbox.push(op);
      this.applyOpLocally(op);
    }
    this.persistSoon();
    this.emit();
    this.syncSoon();
    return Promise.resolve();
  }

  // ---------- Backend API ----------

  async load(): Promise<HostedSnapshot | null> {
    if (!this.loadedOnce) {
      this.loadedOnce = true;
      try {
        if (this.state.cursor === 0) {
          await this.reloadSnapshot();
          await this.persistNow();
        }
        await this.sync();
      } catch (e) {
        if ((e as BackendError).code === 'unauthorised') throw e;
        // Offline: show what this phone has
      }
    }
    const s = this.state.snap;
    return s.mothers.length || s.proposals.length ? s : null;
  }

  subscribe(listener: (u: BackendUpdate) => void): () => void {
    const off = this.listeners.add(listener);
    this.changedAll = true;
    this.emit('remote');
    return off;
  }

  appendEvents(motherId: string, events: ClinicalEvent[]): Promise<void> {
    return this.queue(...events.map((event): SyncOp => ({ opId: randomId('op-'), kind: 'event', motherId, event })));
  }

  async saveMother(mother: Mother): Promise<void> {
    const { profile, events } = splitMother(mother);
    const prev = this.state.snap.mothers.find((m) => m.id === mother.id);
    const known = new Set((prev?.events ?? []).map((e) => e.id));
    const ops: SyncOp[] = [{ opId: randomId('op-'), kind: 'mother', mother: profile, baseUpdatedAt: this.state.confirmedAt[mother.id] }];
    // The server needs her record before her events
    for (const e of events) if (!known.has(e.id)) ops.push({ opId: randomId('op-'), kind: 'event', motherId: mother.id, event: e });
    return this.queue(...ops);
  }

  saveOverride(override: Override): Promise<void> {
    return this.queue({ opId: randomId('op-'), kind: 'override', override });
  }

  saveProposal(proposal: RuleProposal): Promise<void> {
    return this.queue({ opId: randomId('op-'), kind: 'proposal', proposal });
  }

  saveRule(rule: LearnedRule): Promise<void> {
    return this.queue({ opId: randomId('op-'), kind: 'rule', rule });
  }

  saveInbound(message: InboundMessage): Promise<void> {
    return this.queue({ opId: randomId('op-'), kind: 'inbound', message });
  }

  async sendMessage(req: SendMessageRequest, opts: SendOptions = {}): Promise<SendMessageResponse> {
    // Pending record changes first, so the server knows her current number and consent
    if (this.state.outbox.some((o) => o.kind === 'mother' && o.mother.id === req.message.motherId)) await this.sync().catch(() => undefined);
    if (opts.onStatus) {
      const cb = opts.onStatus;
      this.statusWaiters.set(req.message.id, (u) => {
        cb(u);
        if (u.status === 'delivered' || u.status === 'read' || u.status === 'failed') this.statusWaiters.delete(req.message.id);
      });
    }
    try {
      const r = await this.api<SendMessageResponse>('/api/messages/send', { method: 'POST', body: JSON.stringify(req) });
      this.state.snap.outbound = upsert(this.state.snap.outbound, { ...req.message, status: r.status });
      this.changed.add(req.message.motherId);
      for (const u of r.updates) this.applyStatus(u);
      this.persistSoon();
      this.emit();
      return r;
    } catch (e) {
      if ((e as BackendError).code !== 'offline') {
        this.statusWaiters.delete(req.message.id);
        throw e;
      }
      // Keep the record; the worker must send urgent messages another way
      await this.queue({ opId: randomId('op-'), kind: 'message', message: { ...req.message, status: 'queued' } });
      const reason = 'No connection: the message is saved but not sent. For danger signs, call or text her from your own phone now.';
      const u: MessageStatusUpdate = { messageId: req.message.id, motherId: req.message.motherId, status: 'queued', at: new Date().toISOString(), reason };
      return { messageId: req.message.id, status: 'queued', updates: [u], simulated: false, reason };
    }
  }

  async aiProxy(req: AIProxyRequest, opts: AIProxyCallOptions = {}): Promise<AIProxyResponse> {
    if (!opts.onText) return this.api<AIProxyResponse>('/api/ai', { method: 'POST', body: JSON.stringify({ ...req, stream: false }), signal: opts.signal });
    let res: Response;
    try {
      res = await this.f(`${this.base}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ ...req, stream: true }),
        signal: opts.signal,
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') throw e;
      throw new BackendError('offline', 'The AI service needs a connection.');
    }
    if (!res.ok || !res.body) throw new BackendError(res.status === 503 ? 'unavailable' : 'server', `The AI service returned HTTP ${res.status}.`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let event = 'message';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) {
          const data = JSON.parse(line.slice(5).trim());
          if (event === 'text') opts.onText(data.text);
          else if (event === 'done') return data as AIProxyResponse;
          else if (event === 'error') throw new BackendError(data.status === 503 ? 'unavailable' : 'server', data.message);
        }
      }
    }
    throw new BackendError('server', 'The AI reply ended early.');
  }

  hasAIProxy(): boolean {
    return this.aiEnabled && this.online;
  }

  async whoami(): Promise<Identity> {
    if (this.identity) return this.identity;
    try {
      this.identity = await this.api<Identity>('/api/me');
    } catch (e) {
      const saved = savedSession()?.user;
      if (saved) return saved;
      throw e;
    }
    return this.identity;
  }

  async saveMeta(patch: SharedMeta): Promise<void> {
    // Shared settings such as the clock are per-device on a real server: time is real time there
    this.state.snap.meta = { ...this.state.snap.meta, ...patch };
    this.changedAll = true;
    this.persistSoon();
    this.emit();
  }

  async getUserSettings<T = unknown>(key: string): Promise<T | undefined> {
    try {
      const r = await this.api<{ value: T | null }>(`/api/settings/${encodeURIComponent(key)}`);
      if (r.value != null) {
        await this.kv.set(`settings.${key}`, r.value);
        return r.value;
      }
    } catch {
      /* offline */
    }
    return this.kv.get<T>(`settings.${key}`);
  }

  async setUserSettings(key: string, value: unknown): Promise<void> {
    await this.kv.set(`settings.${key}`, value);
    await this.api(`/api/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) }).catch(() => undefined);
  }

  async importSnapshot(s: HostedSnapshot): Promise<void> {
    for (const m of s.mothers) await this.saveMother(m);
    for (const o of s.overrides) await this.saveOverride(o);
    for (const p of s.proposals) await this.saveProposal(p);
    for (const r of s.learnedRules) await this.saveRule(r);
    for (const i of s.inbound) await this.saveInbound(i);
    for (const o of s.outbound) await this.queue({ opId: randomId('op-'), kind: 'message', message: o });
    await this.flush();
  }

  async flush(): Promise<void> {
    clearTimeout(this.timer);
    await this.sync().catch(() => undefined);
    await this.persistNow();
  }

  status(): BackendStatus {
    return {
      kind: 'http',
      label: `Gaskin server (${this.base.replace(/^https?:\/\//, '')})`,
      online: this.online,
      pending: this.state.outbox.length,
      lastSyncAt: this.lastSyncAt,
      stale: !this.lastSyncAt,
    };
  }

  /** Sign out: send what is pending, then forget the session (local copy kept for the next sign-in) */
  async logout(): Promise<void> {
    await this.flush();
    await this.api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearSession();
    this.close();
  }

  close(): void {
    clearTimeout(this.timer);
    clearInterval(this.poll);
    this.es?.close();
    if (typeof window !== 'undefined') window.removeEventListener?.('online', this.onOnline);
  }
}

/** Create the backend for a server. Needs a session from login() (or opts.token). */
export async function createHttpBackend(o: HttpBackendOptions): Promise<Backend & { sync(): Promise<void>; logout(): Promise<void> }> {
  const session = savedSession();
  const token = o.token ?? (session && trim(session.baseUrl) === trim(o.baseUrl) ? session.token : undefined);
  if (!token) throw new BackendError('unauthorised', 'Please sign in with your phone number and PIN.');
  const kv = o.kv ?? (await openKV('gaskin.http.'));
  const b = new HttpBackend({ ...o, token }, kv);
  await b.init();
  return b;
}
