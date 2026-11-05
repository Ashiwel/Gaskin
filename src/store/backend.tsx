/**
 * The bridge between the app's reducer and src/hosted.
 *
 * At start-up it calls pickBackend() once (artifact db inside claude.ai, a Gaskin server when one
 * is configured, otherwise this device), load()s the snapshot and hydrates the reducer. Local
 * actions are written through the backend as small diffs (appendEvents, saveMother, saveOverride,
 * saveProposal, saveRule, saveInbound, saveMeta); updates from elsewhere arrive through
 * subscribe(). Messages go out through backend.sendMessage and their receipts come back as
 * status updates. Nothing here throws or blocks: a viewer who cannot write to the shared demo
 * keeps a working copy on this device, with a quiet note.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { InboundMessage, OutboundMessage } from '../types';
import type { Action, AppState } from './index';
import { fromSeed, loadLocal, recompute, saveLocalCache, SCHEMA } from './index';
import type { Backend, BackendNote, BackendStatus, HostedSnapshot, PickReason, SendMessageRequest } from '../hosted';

// ---------- Status the UI can read ----------

export interface BridgeStatus {
  ready: boolean;
  reason?: PickReason;
  status?: BackendStatus;
  /** The shared store was empty: offer "Load demo data" */
  empty: boolean;
  /** A server is configured but nobody has signed in */
  serverUrl?: string;
  needsLogin: boolean;
  /** Changes stay on this device (viewer of the shared demo, or no shared store) */
  localOnly: boolean;
  /** Short line for the status bar */
  line: string;
}

let current: BridgeStatus = { ready: false, empty: false, needsLogin: false, localOnly: true, line: 'Opening your records…' };
const listeners = new Set<() => void>();
const noteListeners = new Set<(n: BackendNote) => void>();

function setStatus(patch: Partial<BridgeStatus>) {
  current = { ...current, ...patch };
  for (const l of listeners) l();
}

export const bridgeStatus = {
  get: () => current,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useBridgeStatus(): BridgeStatus {
  return useSyncExternalStore(bridgeStatus.subscribe, bridgeStatus.get, bridgeStatus.get);
}

/** Hear backend notes (conflicts, offline, read-only) to show as toasts */
export function onBackendNote(fn: (n: BackendNote) => void): () => void {
  noteListeners.add(fn);
  return () => noteListeners.delete(fn);
}

let backend: Backend | null = null;
let api: { hydrate: (s: HostedSnapshot | null) => void; send: (req: SendMessageRequest) => void; rawDispatch: (a: Action) => void } | null = null;

/** The live backend, once picked (null in tests and during start-up) */
export function getBackend(): Backend | null {
  return backend;
}

// ---------- Snapshot <-> AppState ----------

const RECORDS = ['mothers', 'overrides', 'proposals', 'learnedRules', 'outbound', 'inbound'] as const;
/** Per-viewer view state: never shared */
const VIEW_KEYS = ['country', 'currentWorkerId', 'offline', 'readInbound'] as const;
/** Bulky or derived fields kept out of the shared demo store */
const LOCAL_ONLY_KEYS = ['workers', 'facilities', 'planVersions', 'lastChanges', 'schema'] as const;
const VIEW_KEY = 'gaskin.view.v1';

function sharedMetaKeys(kind: Backend['kind']): string[] {
  const all = Object.keys(fromSeedCached()).filter((k) => !(RECORDS as readonly string[]).includes(k));
  if (kind === 'local') return all; // the device file is the whole state (the assistant connector reads it)
  return all.filter((k) => !(VIEW_KEYS as readonly string[]).includes(k) && !(LOCAL_ONLY_KEYS as readonly string[]).includes(k));
}

let seedCache: AppState | null = null;
function fromSeedCached(): AppState {
  if (!seedCache) seedCache = fromSeed();
  return seedCache;
}

export function snapshotOf(state: AppState, kind: Backend['kind']): HostedSnapshot {
  const meta: Record<string, unknown> = {};
  for (const k of sharedMetaKeys(kind)) meta[k] = (state as unknown as Record<string, unknown>)[k];
  return { mothers: state.mothers, overrides: state.overrides, proposals: state.proposals, learnedRules: state.learnedRules, outbound: state.outbound, inbound: state.inbound, meta };
}

function readView(): Partial<AppState> {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<AppState>;
  } catch {
    return {};
  }
}

function writeView(state: AppState) {
  try {
    const v: Record<string, unknown> = {};
    for (const k of VIEW_KEYS) v[k] = state[k];
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function stateFromSnapshot(s: HostedSnapshot, base: AppState, kind: Backend['kind']): AppState {
  const seed = fromSeedCached();
  const meta = (s.meta ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...seed, ...base };
  for (const k of sharedMetaKeys(kind)) if (meta[k] !== undefined) next[k] = meta[k];
  if (kind !== 'local') Object.assign(next, readView());
  for (const k of RECORDS) next[k] = Array.isArray(s[k]) ? s[k] : [];
  const st = next as unknown as AppState;
  st.schema = SCHEMA;
  if (!Array.isArray(st.workers) || !st.workers.length) st.workers = seed.workers;
  if (!Array.isArray(st.facilities) || !st.facilities.length) st.facilities = seed.facilities;
  if (!st.workers.some((w) => w.id === st.currentWorkerId)) st.currentWorkerId = seed.currentWorkerId;
  // Rebuild the plan baseline from the records, keeping the version numbers people have seen.
  const versions = (meta.planVersions ?? base.planVersions ?? {}) as AppState['planVersions'];
  const rebuilt = recompute({ ...st, planVersions: {}, lastChanges: (meta.lastChanges as AppState['lastChanges']) ?? st.lastChanges ?? {} }, 'all', 'Start');
  for (const [id, v] of Object.entries(rebuilt.planVersions)) if (versions[id]) v.version = Math.max(v.version, versions[id].version);
  return rebuilt;
}

// ---------- Diff local changes into backend writes ----------

function diffWrite(b: Backend, prev: AppState, next: AppState) {
  const safe = (p: Promise<unknown> | undefined) => p?.catch((e) => console.warn('[gaskin] save failed', e));
  if (prev.mothers !== next.mothers) {
    const before = new Map(prev.mothers.map((m) => [m.id, m]));
    for (const m of next.mothers) {
      const old = before.get(m.id);
      if (old === m) continue;
      if (!old) {
        safe(b.saveMother(m));
        continue;
      }
      const { events: e1, ...p1 } = old;
      const { events: e2, ...p2 } = m;
      const known = new Set(e1.map((e) => e.id));
      const fresh = e2.filter((e) => !known.has(e.id));
      if (JSON.stringify(p1) !== JSON.stringify(p2) || fresh.length !== e2.length - e1.length) safe(b.saveMother(m));
      else if (fresh.length) safe(b.appendEvents(m.id, fresh));
    }
  }
  const each = <T extends { id: string }>(a: T[], z: T[], save: (x: T) => Promise<void>) => {
    if (a === z) return;
    const before = new Map(a.map((x) => [x.id, x]));
    for (const x of z) if (before.get(x.id) !== x) safe(save(x));
  };
  each(prev.overrides, next.overrides, (o) => b.saveOverride(o));
  each(prev.proposals, next.proposals, (p) => b.saveProposal(p));
  each(prev.learnedRules, next.learnedRules, (r) => b.saveRule(r));
  each<InboundMessage>(prev.inbound, next.inbound, (m) => b.saveInbound(m));
  // Meta: only the fields that changed
  const patch: Record<string, unknown> = {};
  for (const k of sharedMetaKeys(b.kind)) {
    const a = (prev as unknown as Record<string, unknown>)[k];
    const z = (next as unknown as Record<string, unknown>)[k];
    if (a !== z) patch[k] = z;
  }
  if (Object.keys(patch).length) safe(b.saveMeta(patch));
}

// ---------- The hook ----------

const START_WAIT_MS = 1500;

/**
 * Connects the reducer to the backend. Returns the dispatch the app uses: every local action is
 * applied at once and then saved through the backend.
 */
export function useBackendBridge(state: AppState, rawDispatch: (a: Action) => void): (a: Action) => void {
  const prev = useRef(state);
  const dirty = useRef(false);
  const whole = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback(
    (a: Action) => {
      if (a.type === 'reset' || a.type === 'import') {
        whole.current = true;
        rawDispatch(a);
        return;
      }
      dirty.current = true;
      rawDispatch(a);
    },
    [rawDispatch],
  );

  // Write local changes through the backend
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (!backend) {
      saveLocalCache(state);
      return;
    }
    if (backend.kind !== 'local') writeView(state);
    if (whole.current) {
      // Reset or import: the whole record set is replaced on this device
      whole.current = false;
      dirty.current = false;
      if (backend.kind === 'local') void backend.importSnapshot(snapshotOf(state, 'local')).catch(() => undefined);
      return;
    }
    if (!dirty.current || before === state) return;
    dirty.current = false;
    diffWrite(backend, before, state);
    // Back online: hand queued messages to the backend
    if (before.offline && !state.offline) {
      for (const m of before.outbound.filter((o) => o.status === 'queued')) api?.send({ message: m });
    }
  }, [state]);

  // Pick, load, subscribe (once)
  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    const waited = window.setTimeout(() => setStatus({ ready: true }), START_WAIT_MS);

    api = {
      rawDispatch,
      hydrate(snap) {
        const b = backend;
        if (!b) return;
        if (snap) {
          try {
            const next = stateFromSnapshot(snap, stateRef.current, b.kind);
            prev.current = next;
            rawDispatch({ type: 'hydrate', state: next });
          } catch (e) {
            console.warn('[gaskin] could not open the saved records', e);
          }
        }
      },
      send(req) {
        const b = backend;
        if (!b) return;
        b.sendMessage(req, {
          onStatus: (u) => rawDispatch({ type: 'setOutboundStatus', id: u.messageId, status: u.status, at: u.at }),
        })
          .then((r) => {
            if (r.status === 'failed') {
              rawDispatch({ type: 'setOutboundStatus', id: r.messageId, status: 'failed', at: new Date().toISOString() });
              if (r.reason) for (const l of noteListeners) l({ id: r.messageId, at: new Date().toISOString(), level: 'warning', text: `Not sent: ${r.reason}` });
            }
          })
          .catch(() => undefined);
      },
    };

    (async () => {
      let picked: { backend: Backend; reason: PickReason; serverUrl?: string };
      try {
        const { pickBackend } = await import('../hosted');
        picked = await pickBackend();
      } catch (e) {
        console.warn('[gaskin] no backend; working in memory', e);
        setStatus({ ready: true, line: 'Working on this device' });
        return;
      }
      if (cancelled) {
        picked.backend.close();
        return;
      }
      await attach(picked.backend, picked.reason, picked.serverUrl);
      window.clearTimeout(waited);
    })();

    async function attach(b: Backend, reason: PickReason, serverUrl?: string) {
      backend?.close();
      off?.();
      backend = b;
      publishStatus(b, reason, serverUrl);
      let snap: HostedSnapshot | null = null;
      try {
        snap = await b.load();
      } catch {
        snap = null;
      }
      if (snap) api?.hydrate(snap);
      else if (b.kind === 'local') {
        // A new device (or an old browser cache): start the device file from what we have.
        const start = loadLocal();
        rawDispatch({ type: 'hydrate', state: start });
        prev.current = start;
        await b.importSnapshot(snapshotOf(start, 'local')).catch(() => undefined);
      } else setStatus({ empty: true });
      off = b.subscribe((u) => {
        for (const n of u.notes) for (const l of noteListeners) l(n);
        for (const m of u.messageUpdates) rawDispatch({ type: 'setOutboundStatus', id: m.messageId, status: m.status, at: m.at });
        publishStatus(b, reason, serverUrl, u.status);
        if (u.origin === 'remote' && snapReady(u.snapshot)) {
          const cur = stateRef.current;
          const next = stateFromSnapshot(u.snapshot, cur, b.kind);
          const changed = u.changedMotherIds;
          const keep = changed === 'all' ? null : new Set(changed);
          const mothers = keep ? next.mothers.map((m) => (keep.has(m.id) ? m : cur.mothers.find((x) => x.id === m.id) ?? m)) : next.mothers;
          const patch: Partial<AppState> = {
            mothers,
            overrides: next.overrides,
            proposals: next.proposals,
            learnedRules: next.learnedRules,
            outbound: mergeOutbound(cur.outbound, next.outbound),
            inbound: next.inbound,
            clock: next.clock,
            libraryVersion: next.libraryVersion,
            releases: next.releases,
          };
          rawDispatch({ type: 'remote', patch, changed: changed === 'all' ? [] : changed, cause: 'Updated by a colleague' });
        }
        if (u.snapshot.mothers.length) setStatus({ empty: false });
      });
      setStatus({ ready: true });
    }

    async function relogin(phone: string, pin: string): Promise<string | null> {
      const url = current.serverUrl;
      if (!url) return 'No server is set.';
      try {
        const { login, pickBackend } = await import('../hosted');
        await login(url, phone, pin);
        const p = await pickBackend({ serverUrl: url });
        await attach(p.backend, p.reason, p.serverUrl);
        return null;
      } catch (e) {
        return (e as Error)?.message || 'Could not sign in.';
      }
    }
    loginImpl = relogin;

    return () => {
      cancelled = true;
      window.clearTimeout(waited);
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return dispatch;
}

function snapReady(s: HostedSnapshot): boolean {
  return Array.isArray(s.mothers) && s.mothers.length > 0;
}

function mergeOutbound(a: OutboundMessage[], b: OutboundMessage[]): OutboundMessage[] {
  const rank: Record<OutboundMessage['status'], number> = { draft: 0, queued: 1, sent: 2, delivered: 3, read: 4, failed: 5 };
  const byId = new Map(a.map((m) => [m.id, m]));
  const out = b.map((m) => {
    const old = byId.get(m.id);
    return old && rank[old.status] > rank[m.status] ? { ...m, status: old.status } : m;
  });
  for (const m of a) if (!out.some((x) => x.id === m.id)) out.push(m);
  return out;
}

function publishStatus(b: Backend, reason: PickReason, serverUrl?: string, st?: BackendStatus) {
  const s = st ?? b.status();
  const localOnly = b.kind === 'local' || Boolean(s.fallbackReason);
  let line: string;
  if (b.kind === 'artifact') line = s.fallbackReason ? 'Shared demo · your changes stay on this device' : s.pending ? `Shared demo · saving ${s.pending}` : 'Shared demo · saved';
  else if (b.kind === 'http') line = s.online ? (s.pending ? `Syncing ${s.pending} change${s.pending === 1 ? '' : 's'}` : `${s.label} · synced`) : `Offline · ${s.pending} waiting`;
  else line = reason === 'server_needs_login' ? 'Not signed in · saved on this device' : s.label || 'Saved on this device';
  setStatus({ reason, status: s, serverUrl, needsLogin: reason === 'server_needs_login', localOnly, line });
}

// ---------- Actions for screens ----------

let loginImpl: ((phone: string, pin: string) => Promise<string | null>) | null = null;

/** Sign in to the configured Gaskin server, then switch to it. Resolves an error message or null. */
export function signIn(phone: string, pin: string): Promise<string | null> {
  return loginImpl ? loginImpl(phone, pin) : Promise.resolve('Not ready yet.');
}

/** Send through the backend (simulated delivery in the demo, real gateways on a server). */
export function sendThroughBackend(req: SendMessageRequest): boolean {
  if (!backend || !api) return false;
  api.send(req);
  return true;
}

/** Fill an empty shared workspace with the synthetic cohort */
export async function loadDemoData(): Promise<void> {
  const b = backend;
  if (!b || !api) return;
  const seed = fromSeed();
  await b.importSnapshot(snapshotOf(seed, b.kind)).catch(() => undefined);
  api.rawDispatch({ type: 'hydrate', state: seed });
  setStatus({ empty: false });
}

/**
 * Start again. On this device: the seed replaces the device file. In the shared demo: this
 * viewer's own working copy is cleared and the shared data shown again.
 */
export async function hardReset(): Promise<void> {
  const b = backend;
  try {
    if (b?.kind === 'local') await b.importSnapshot(snapshotOf(fromSeed(), 'local'));
    else if (b?.kind === 'artifact') {
      const { openKV } = await import('../hosted/kv');
      await (await openKV('gaskin.artifact.')).del('artifact.overlay');
    }
    await b?.flush();
  } catch {
    /* ignore */
  }
}

export function BackendGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const s = useBridgeStatus();
  return <>{s.ready ? children : fallback}</>;
}

/** Render-prop wrapper so the store can stay a plain reducer */
export function BackendBridge({ state, rawDispatch, children }: { state: AppState; rawDispatch: (a: Action) => void; children: (dispatch: (a: Action) => void) => ReactNode }) {
  const dispatch = useBackendBridge(state, rawDispatch);
  return <>{children(dispatch)}</>;
}
