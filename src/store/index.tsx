import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { BackendBridge } from './backend';
import type {
  CarePlan,
  ClinicalEvent,
  DemoState,
  InboundMessage,
  LearnedRule,
  Mother,
  OutboundMessage,
  Override,
  PlanDiff,
  Worker,
} from '../types';
import { buildPlan, deriveState, upsertProposal, approveProposal } from '../engine';
import { createSeedState } from '../data';
import { advanceClock, SCENARIOS } from '../demo';
import type { TriageTier } from './triage';
import { setPrivacyDirectory } from '../privacy';
import { getLocationProfile, toPlanLocation } from '../location';

export * from './triage';

// ---------- App state ----------

export interface AlertAck {
  motherId: string;
  alertId: string;
  note: string;
  by: string;
  at: string;
}

export type DeliveryStep = 'queued' | 'sent' | 'delivered' | 'read';

export interface MessageMeta {
  recipient: 'mother' | 'carer';
  recipientName?: string;
  number?: string;
  subject?: string;
  times: Partial<Record<DeliveryStep, string>>;
  /** Sent while offline as a danger-sign SMS fallback */
  smsFallback?: boolean;
}

export interface Release {
  version: string;
  publishedAt: string;
  publishedBy: string;
  ruleIds: string[];
}

export interface Carer {
  name: string;
  relation: string;
  number?: string;
}

export interface ChangeRecord {
  diff: PlanDiff;
  at: string;
  version: number;
  cause: string;
}

export interface AppState extends DemoState {
  schema: number;
  offline: boolean;
  alertAcks: AlertAck[];
  /** Approved rules waiting for the next content release */
  pendingRules: LearnedRule[];
  releases: Release[];
  libraryVersion: string;
  messageMeta: Record<string, MessageMeta>;
  carers: Record<string, Carer>;
  lastChanges: Record<string, ChangeRecord>;
  readInbound: Record<string, string>;
  inboundTriage: Record<string, TriageTier>;
  appliedScenarios: Array<{ id: string; motherId: string; at: string }>;
}

export const SCHEMA = 3;
const STORAGE_KEY = `gaskin.demo.v${SCHEMA}`;

export type Action =
  | { type: 'addEvents'; motherId: string; events: ClinicalEvent[]; cause: string }
  | { type: 'addOverride'; override: Override; now: string; changed?: string[] }
  | { type: 'revertOverride'; id: string }
  | { type: 'reviewProposal'; id: string; decision: 'approved' | 'rejected' | 'needs_evidence'; note: string; now: string }
  | { type: 'publishRelease'; now: string }
  | { type: 'ackAlert'; ack: AlertAck }
  | { type: 'sendMessage'; message: OutboundMessage; meta: MessageMeta }
  | { type: 'messageStatus'; id: string; status: DeliveryStep; at: string }
  | { type: 'inbound'; message: InboundMessage; events: ClinicalEvent[]; triage: TriageTier }
  | { type: 'markRead'; motherId: string; at: string }
  | { type: 'advanceClock'; days: number }
  | { type: 'setCountry'; country: AppState['country'] }
  | { type: 'setWorker'; workerId: string }
  | { type: 'setOffline'; offline: boolean; now: string }
  | { type: 'applyScenario'; scenarioId: string; motherId: string }
  | { type: 'setCarer'; motherId: string; carer: Carer }
  | { type: 'dismissChanges'; motherId: string }
  | { type: 'import'; state: AppState }
  | { type: 'register'; mother: Mother }
  | { type: 'updateMother'; mother: Mother; cause?: string }
  | { type: 'hydrate'; state: AppState }
  | { type: 'remote'; patch: Partial<AppState>; changed: string[] | 'all'; cause: string }
  | { type: 'setOutboundStatus'; id: string; status: OutboundMessage['status']; at: string }
  | { type: 'reset' };

// ---------- Plan bookkeeping ----------

function isEmptyDiff(d?: PlanDiff): boolean {
  return !d || d.added.length + d.removed.length + d.changed.length + d.newAlerts.length === 0;
}

const locationCache = new Map<string, ReturnType<typeof toPlanLocation> | undefined>();

/** Local foods, practices and malaria policy for where she lives (cached per region). */
export function planLocationFor(m: Pick<Mother, 'country' | 'region'>) {
  const key = `${m.country}|${m.region}`;
  if (!locationCache.has(key)) {
    let loc: ReturnType<typeof toPlanLocation> | undefined;
    try {
      loc = toPlanLocation(getLocationProfile(m.country, m.region));
    } catch {
      loc = undefined;
    }
    locationCache.set(key, loc);
  }
  return locationCache.get(key);
}

/**
 * The one place the app computes a plan. Visit referrals (club foot, cleft palate, hips,
 * development) are raised as alerts inside the engine, so every caller sees them.
 */
export function planFor(state: Pick<AppState, 'clock' | 'overrides' | 'learnedRules' | 'planVersions'>, m: Mother): CarePlan {
  return buildPlan(m, state.clock, {
    overrides: state.overrides.filter((o) => o.motherId === m.id),
    learnedRules: state.learnedRules,
    previous: state.planVersions[m.id],
    location: planLocationFor(m),
  });
}

/** Recompute plans for the given mothers, record what changed, and move the version on. */
export function recompute(state: AppState, ids: string[] | 'all', cause: string, extraChanged: string[] = []): AppState {
  const targets = ids === 'all' ? state.mothers : state.mothers.filter((m) => ids.includes(m.id));
  const planVersions = { ...state.planVersions };
  const lastChanges = { ...state.lastChanges };
  for (const m of targets) {
    let plan: CarePlan;
    try {
      plan = planFor(state, m);
    } catch {
      continue;
    }
    const prev = state.planVersions[m.id];
    const itemIds = plan.items.filter((i) => i.status !== 'removed').map((i) => i.id);
    const alertIds = plan.alerts.map((a) => a.id);
    let diff: PlanDiff | undefined = plan.changes;
    if (prev) {
      // Our own diff as a safety net in case the engine leaves it out.
      const added = itemIds.filter((i) => !prev.itemIds.includes(i));
      const removed = prev.itemIds.filter((i) => !itemIds.includes(i));
      const newAlerts = alertIds.filter((a) => !prev.alertIds.includes(a));
      diff = {
        added: Array.from(new Set([...(diff?.added ?? []), ...added])),
        removed: Array.from(new Set([...(diff?.removed ?? []), ...removed])),
        changed: Array.from(new Set([...(diff?.changed ?? []), ...extraChanged.filter((c) => itemIds.includes(c))])),
        newAlerts: Array.from(new Set([...(diff?.newAlerts ?? []), ...newAlerts])),
      };
    }
    const changed = prev ? !isEmptyDiff(diff) : false;
    const version = prev ? prev.version + (changed ? 1 : 0) : Math.max(1, plan.version || 1);
    planVersions[m.id] = { version, itemIds, alertIds };
    if (changed && diff) lastChanges[m.id] = { diff, at: state.clock, version, cause };
  }
  return { ...state, planVersions, lastChanges };
}

// ---------- Init / persistence ----------

export function fromSeed(): AppState {
  const seed = createSeedState();
  const base: AppState = {
    ...seed,
    planVersions: {},
    schema: SCHEMA,
    offline: false,
    alertAcks: [],
    pendingRules: [],
    releases: [{ version: '1.3', publishedAt: seed.clock, publishedBy: 'Clinical board', ruleIds: seed.learnedRules.map((r) => r.id) }],
    libraryVersion: '1.3',
    messageMeta: {},
    carers: {},
    lastChanges: {},
    readInbound: {},
    inboundTriage: {},
    appliedScenarios: [],
  };
  return recompute(base, 'all', 'Start');
}

export function loadLocal(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.schema === SCHEMA && Array.isArray(parsed.mothers) && parsed.mothers.length) return parsed;
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return fromSeed();
}

function save(state: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function nextLibraryVersion(v: string): string {
  const [maj, min] = v.split('.').map((n) => parseInt(n, 10) || 0);
  return `${maj}.${min + 1}`;
}

function mapMother(state: AppState, id: string, fn: (m: Mother) => Mother): AppState {
  return { ...state, mothers: state.mothers.map((m) => (m.id === id ? fn(m) : m)) };
}

// ---------- Reducer ----------

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addEvents': {
      const next = mapMother(state, action.motherId, (m) => {
        let mother: Mother = { ...m, events: [...m.events, ...action.events] };
        for (const e of action.events) {
          if (e.kind === 'birth') {
            mother = { ...mother, birth: e.birth, children: [...mother.children.filter((c) => c.id !== e.child.id), e.child] };
          }
          if (e.kind === 'feeding' && e.childId) {
            mother = { ...mother, children: mother.children.map((c) => (c.id === e.childId ? { ...c, feeding: e.status } : c)) };
          }
        }
        return mother;
      });
      return recompute(next, [action.motherId], action.cause);
    }
    case 'addOverride': {
      const o = action.override;
      let proposals = state.proposals;
      if (o.proposeGlobal) {
        const m = state.mothers.find((x) => x.id === o.motherId);
        if (m) {
          try {
            proposals = upsertProposal(o, m, deriveState(m, state.clock), state.proposals, action.now);
          } catch {
            /* engine refused; the patient-level change still stands */
          }
        }
      }
      const next = { ...state, overrides: [...state.overrides, o], proposals };
      return recompute(next, [o.motherId], 'Your change', action.changed ?? (o.action === 'modify' ? [o.itemId] : []));
    }
    case 'revertOverride': {
      const o = state.overrides.find((x) => x.id === action.id);
      if (!o) return state;
      const next = { ...state, overrides: state.overrides.map((x) => (x.id === action.id ? { ...x, status: 'reverted' as const } : x)) };
      return recompute(next, [o.motherId], 'Change reverted', o.action === 'modify' ? [o.itemId] : []);
    }
    case 'reviewProposal': {
      const p = state.proposals.find((x) => x.id === action.id);
      if (!p) return state;
      if (action.decision === 'approved') {
        try {
          const { proposal, rule } = approveProposal(p, state.currentWorkerId, action.note, action.now);
          return {
            ...state,
            proposals: state.proposals.map((x) => (x.id === p.id ? proposal : x)),
            pendingRules: [...state.pendingRules, rule],
          };
        } catch {
          return state;
        }
      }
      return {
        ...state,
        proposals: state.proposals.map((x) =>
          x.id === p.id ? { ...x, status: action.decision, reviewedBy: state.currentWorkerId, reviewNote: action.note, reviewedAt: action.now } : x,
        ),
      };
    }
    case 'publishRelease': {
      if (!state.pendingRules.length) return state;
      const version = nextLibraryVersion(state.libraryVersion);
      const next: AppState = {
        ...state,
        learnedRules: [...state.learnedRules, ...state.pendingRules],
        pendingRules: [],
        libraryVersion: version,
        releases: [
          ...state.releases,
          { version, publishedAt: action.now, publishedBy: state.currentWorkerId, ruleIds: state.pendingRules.map((r) => r.id) },
        ],
      };
      return recompute(next, 'all', `Library v${version} released`);
    }
    case 'ackAlert':
      return {
        ...state,
        alertAcks: [...state.alertAcks.filter((a) => !(a.motherId === action.ack.motherId && a.alertId === action.ack.alertId)), action.ack],
      };
    case 'sendMessage':
      return {
        ...state,
        outbound: [...state.outbound, action.message],
        messageMeta: { ...state.messageMeta, [action.message.id]: action.meta },
      };
    case 'messageStatus': {
      const meta = state.messageMeta[action.id] ?? { recipient: 'mother', times: {} };
      return {
        ...state,
        outbound: state.outbound.map((m) =>
          m.id === action.id ? { ...m, status: action.status, sentAt: action.status === 'sent' ? action.at : m.sentAt } : m,
        ),
        messageMeta: { ...state.messageMeta, [action.id]: { ...meta, times: { ...meta.times, [action.status]: action.at } } },
      };
    }
    case 'inbound': {
      const withMsg: AppState = {
        ...state,
        inbound: [...state.inbound, action.message],
        inboundTriage: { ...state.inboundTriage, [action.message.id]: action.triage },
      };
      if (!action.events.length) return withMsg;
      const next = mapMother(withMsg, action.message.motherId, (m) => ({ ...m, events: [...m.events, ...action.events] }));
      return recompute(next, [action.message.motherId], 'Message from her');
    }
    case 'markRead':
      return { ...state, readInbound: { ...state.readInbound, [action.motherId]: action.at } };
    case 'advanceClock': {
      let moved: DemoState;
      try {
        moved = advanceClock(state, action.days);
      } catch {
        const d = new Date(state.clock);
        d.setUTCDate(d.getUTCDate() + action.days);
        moved = { ...state, clock: d.toISOString() };
      }
      const label = action.days === 1 ? '1 day later' : action.days % 7 === 0 ? `${action.days / 7} week${action.days === 7 ? '' : 's'} later` : `${action.days} days later`;
      return recompute({ ...state, ...moved }, 'all', label);
    }
    case 'setCountry':
      return { ...state, country: action.country };
    case 'setWorker':
      return { ...state, currentWorkerId: action.workerId };
    case 'setOffline': {
      if (action.offline) return { ...state, offline: true };
      // Back online: flush everything that was waiting.
      const queued = state.outbound.filter((m) => m.status === 'queued');
      const meta = { ...state.messageMeta };
      for (const q of queued) meta[q.id] = { ...(meta[q.id] ?? { recipient: 'mother', times: {} }), times: { ...(meta[q.id]?.times ?? {}), sent: action.now } };
      return {
        ...state,
        offline: false,
        outbound: state.outbound.map((m) => (m.status === 'queued' ? { ...m, status: 'sent', sentAt: action.now } : m)),
        messageMeta: meta,
      };
    }
    case 'applyScenario': {
      const sc = SCENARIOS.find((s) => s.id === action.scenarioId);
      if (!sc) return state;
      let applied: DemoState;
      try {
        applied = sc.apply(state, action.motherId);
      } catch {
        return state;
      }
      const next: AppState = {
        ...state,
        ...applied,
        appliedScenarios: [...state.appliedScenarios, { id: sc.id, motherId: action.motherId, at: state.clock }],
      };
      // Scenarios may add inbound messages: triage any new ones.
      const triage = { ...next.inboundTriage };
      for (const msg of next.inbound) if (!triage[msg.id]) triage[msg.id] = triageFor(msg);
      return recompute({ ...next, inboundTriage: triage }, [action.motherId], sc.title);
    }
    case 'setCarer':
      return { ...state, carers: { ...state.carers, [action.motherId]: action.carer } };
    case 'dismissChanges': {
      const lc = { ...state.lastChanges };
      delete lc[action.motherId];
      return { ...state, lastChanges: lc };
    }
    case 'register':
      return recompute({ ...state, mothers: [...state.mothers, action.mother] }, [action.mother.id], 'Registered');
    case 'updateMother':
      return recompute(mapMother(state, action.mother.id, () => action.mother), [action.mother.id], action.cause ?? 'Record updated');
    case 'hydrate':
      return action.state;
    case 'remote': {
      const next = { ...state, ...action.patch };
      return action.changed === 'all' || action.changed.length ? recompute(next, action.changed, action.cause) : next;
    }
    case 'setOutboundStatus': {
      const cur = state.outbound.find((m) => m.id === action.id);
      if (!cur) return state;
      const rank: Record<OutboundMessage['status'], number> = { draft: 0, queued: 1, sent: 2, delivered: 3, read: 4, failed: 5 };
      if (rank[action.status] <= rank[cur.status] && action.status !== 'failed') return state;
      const step = action.status as DeliveryStep;
      const meta = state.messageMeta[action.id] ?? { recipient: 'mother', times: {} };
      return {
        ...state,
        outbound: state.outbound.map((m) => (m.id === action.id ? { ...m, status: action.status, sentAt: action.status === 'sent' ? action.at : m.sentAt } : m)),
        messageMeta: action.status === 'failed' ? state.messageMeta : { ...state.messageMeta, [action.id]: { ...meta, times: { ...meta.times, [step]: action.at } } },
      };
    }
    case 'import':
      return recompute({ ...fromSeed(), ...action.state, schema: SCHEMA }, 'all', 'Backup imported');
    case 'reset':
      return fromSeed();
    default:
      return state;
  }
}

import { triageSymptoms } from './triage';
export function triageFor(msg: InboundMessage): TriageTier {
  return triageSymptoms(msg.parsedSymptoms);
}

// ---------- Context ----------

interface Ctx {
  state: AppState;
  dispatch: (a: Action) => void;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, loadLocal);
  // Every known name, community and facility is scrubbed from anything sent to an AI.
  useEffect(() => {
    try {
      setPrivacyDirectory({
        mothers: state.mothers,
        workers: state.workers,
        facilities: state.facilities,
        extraNames: Object.values(state.carers).map((c) => ({ name: c.name, placeholder: '[CARER]' as const })),
      });
    } catch {
      /* privacy layer unavailable: AI calls still de-identify per mother */
    }
  }, [state.mothers, state.workers, state.facilities, state.carers]);
  return (
    <BackendBridge state={state} rawDispatch={rawDispatch}>
      {(dispatch) => <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>}
    </BackendBridge>
  );
}

/** The browser cache of the working copy, for a fast start (the backend holds the record). */
export function saveLocalCache(state: AppState) {
  save(state);
}

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

/** All current plans, keyed by mother id. Memoised on the inputs that change plans. */
export function usePlans(): Map<string, CarePlan> {
  const { state } = useApp();
  const { mothers, clock, overrides, learnedRules, planVersions } = state;
  return useMemo(() => {
    const map = new Map<string, CarePlan>();
    for (const m of mothers) {
      try {
        map.set(m.id, planFor({ clock, overrides, learnedRules, planVersions }, m));
      } catch (err) {
        console.warn('Plan could not be built for', m.id, err);
      }
    }
    return map;
  }, [mothers, clock, overrides, learnedRules, planVersions]);
}

export function useWorker(): Worker {
  const { state } = useApp();
  return state.workers.find((w) => w.id === state.currentWorkerId) ?? state.workers[0];
}

/** A timestamp on the simulated day, using the real time of day so events sort naturally. */
export function stamp(clock: string): string {
  const d = new Date(clock);
  const now = new Date();
  d.setUTCHours(now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
  return d.toISOString();
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
