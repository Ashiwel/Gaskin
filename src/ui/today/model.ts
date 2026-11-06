/**
 * The caseload model behind Today, Mothers and Visits: one row per mother with her urgency, the
 * single top reason, unread replies, the contacts due for her and each child, a few readings for
 * sparklines, and where she is in the first 1,000 days.
 */
import { useMemo } from 'react';
import type { Alert, CarePlan, Child, InboundMessage, Mother } from '../../types';
import { useApp, usePlans, useWorker, triageFor, type AppState, type TriageTier } from '../../store';
import { collectFacts } from '../../engine/facts';
import { ancPlan, immunisationStatus, pncContacts, ANC_WEEKS } from '../../engine/schedule';
import type { JourneyContact } from '../../components/viz';
import { addDays, daysBetween, isoDay, relDay, topAlert, urgencyOf, URGENCY_RANK, type Urgency } from '../format';
import { inScope, useScope, type Scope } from './access';

export interface DueContact {
  motherId: string;
  /** ISO day. Overdue contacts keep their original date; `overdueDays` says by how much. */
  date: string;
  label: string;
  kind: 'anc' | 'pnc' | 'child' | 'home';
  childId?: string;
  childName?: string;
  overdueDays: number;
}

export interface Reading {
  kind: 'bp' | 'hb';
  values: number[];
  /** Latest as text: "150/100" or "7.9" */
  latest: string;
  unit: string;
  tone: 'danger' | 'warning' | 'brand';
}

export interface CaseRow {
  mother: Mother;
  plan: CarePlan;
  urgency: Urgency;
  score: number;
  reason: string;
  unread: number;
  triage?: TriageTier;
  /** The alert that drives her urgency, if any (danger alerts are acknowledged, never dismissed). */
  alert?: Alert;
  /** The child the top alert is about, when it is about a child. */
  alertChild?: Child;
  /** Every contact due for her and her children, soonest first. */
  contacts: DueContact[];
  /** Children within the 1,000 days (and older ones still on her record), youngest last. */
  children: Child[];
  reading?: Reading;
  journeyDay?: number;
  journey: JourneyContact[];
  /** Highest risk severity, for filters and dots. */
  riskLevel: 'danger' | 'high' | 'moderate' | 'low';
}

export function unreadFor(motherId: string, inbound: { motherId: string; receivedAt: string }[], readAt?: string): number {
  return inbound.filter((m) => m.motherId === motherId && (!readAt || m.receivedAt > readAt)).length;
}

function readingFor(m: Mother, plan: CarePlan): Reading | undefined {
  const risks = plan.state.risks.map((r) => r.code).join(' ');
  const bp = m.events.filter((e) => e.kind === 'vitals' && e.systolic && e.diastolic && !e.childId) as Array<{ systolic: number; diastolic: number; at: string }>;
  const sys = plan.state.latest.systolic;
  const dia = plan.state.latest.diastolic;
  const bpRisk = /pre_eclampsia|hypertension/.test(risks) || (sys ?? 0) >= 140 || (dia ?? 0) >= 90;
  if (bpRisk && bp.length && sys && dia) {
    const values = bp.slice(-8).map((e) => e.systolic);
    const tone = sys >= 160 || dia >= 110 ? 'danger' : sys >= 140 || dia >= 90 ? 'warning' : 'brand';
    return { kind: 'bp', values, latest: `${sys}/${dia}`, unit: 'mmHg', tone };
  }
  const hbEvents = m.events.filter((e) => e.kind === 'lab' && e.test === 'haemoglobin' && typeof e.value === 'number') as Array<{ value: number }>;
  const hb = plan.state.latest.haemoglobin;
  if (hb !== undefined && hbEvents.length && (hb < 11 || /anaemia/.test(risks))) {
    return { kind: 'hb', values: hbEvents.slice(-8).map((e) => e.value), latest: hb.toFixed(1), unit: 'g/dL', tone: hb < 7 ? 'danger' : hb < 10 ? 'warning' : 'brand' };
  }
  return undefined;
}

/** Contacts for her and every child: the plan's next contact plus each other child's next vaccines. */
function contactsFor(m: Mother, plan: CarePlan, clock: string): { contacts: DueContact[]; journey: JourneyContact[]; children: Child[] } {
  const today = isoDay(clock);
  const contacts: DueContact[] = [];
  const journey: JourneyContact[] = [];
  let children: Child[] = m.children;
  try {
    const f = collectFacts(m, clock);
    children = f.children;
    const nc = plan.nextContact;
    if (nc) {
      const date = isoDay(nc.date);
      const child = nc.type === 'child_health' ? f.youngest : undefined;
      const overdue = Math.max(0, daysBetween(date, today));
      contacts.push({
        motherId: m.id,
        date,
        label: child ? nc.label.replace(/^[^:]+:\s*/, '') : nc.label,
        kind: nc.type === 'anc' ? 'anc' : nc.type === 'child_health' ? 'child' : nc.type === 'pnc' ? 'pnc' : 'home',
        childId: child?.id,
        childName: child?.name,
        overdueDays: /overdue/.test(nc.label) ? Math.max(overdue, 1) : overdue,
      });
    }
    // Every child under 1,000 days gets her own due item: the engine's ChildState when present.
    const engineKids = new Map((plan.state.children ?? []).map((k) => [k.childId, k]));
    for (const c of f.under1000) {
      if (c.id === f.youngest?.id && nc?.type === 'child_health') continue;
      if (f.youngest?.id === c.id && f.daysSinceBirth !== undefined && f.daysSinceBirth <= 56) continue;
      const imm = engineKids.get(c.id)?.immunisation ?? immunisationStatus(f, c);
      if (!imm.next) continue;
      const date = imm.next.overdueDays > 0 ? today : isoDay(imm.next.due);
      contacts.push({ motherId: m.id, date, label: `${imm.next.label} vaccines`, kind: 'child', childId: c.id, childName: c.name, overdueDays: imm.next.overdueDays });
    }
    // The journey: where she is, and the contacts on it.
    const anc = ancPlan(f);
    if (anc && f.lmp) {
      const lmpDay = (w: number) => w * 7 - 14;
      ANC_WEEKS.forEach((w, i) => {
        const n = i + 1;
        const state: JourneyContact['state'] = n <= anc.attended ? 'done' : anc.next?.contactNumber === n ? (anc.next.overdueDays > 0 ? 'overdue' : 'due') : 'upcoming';
        journey.push({ day: lmpDay(w), label: `ANC contact ${n}`, state });
      });
    }
    const pnc = pncContacts(f);
    if (pnc) for (const p of pnc) journey.push({ day: 266 + p.start, label: p.label, state: p.status === 'done' ? 'done' : p.status === 'due' ? 'due' : p.status === 'overdue' ? 'overdue' : p.status === 'missed' ? 'missed' : 'upcoming' });
    const y = f.youngest;
    if (y && f.youngestAgeDays !== undefined && f.youngestAgeDays <= 1000 && !f.pregnant) {
      const imm = immunisationStatus(f, y);
      if (imm.next) {
        const day = 266 + daysBetween(y.dob, imm.next.due);
        journey.push({ day, label: `${imm.next.label} vaccines`, state: imm.next.overdueDays > 0 ? 'overdue' : daysBetween(today, isoDay(imm.next.due)) <= 0 ? 'due' : 'upcoming' });
      }
    }
  } catch {
    /* an unusual record still shows, without its schedule */
  }
  contacts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { contacts, journey, children };
}

function riskLevelOf(plan: CarePlan): CaseRow['riskLevel'] {
  if (plan.alerts.some((a) => a.level === 'emergency')) return 'danger';
  const sev = plan.state.risks.map((r) => r.severity);
  if (sev.includes('urgent') || sev.includes('high') || plan.alerts.some((a) => a.level === 'urgent')) return 'high';
  if (sev.includes('moderate') || plan.alerts.length) return 'moderate';
  return 'low';
}

export function buildRow(state: AppState, m: Mother, plan: CarePlan): CaseRow {
  const urgency = urgencyOf(plan, state.clock);
  const cp = plan.state.contactPriority;
  const a = topAlert(plan.alerts);
  let reason = cp?.reasons?.[0] ?? '';
  if (!reason) {
    if (a) reason = a.title;
    else if (plan.nextContact) {
      const d = daysBetween(state.clock, plan.nextContact.date);
      reason = d < 0 ? `${plan.nextContact.label} was due ${relDay(plan.nextContact.date, state.clock)}` : `${plan.nextContact.label}, ${relDay(plan.nextContact.date, state.clock)}`;
    } else reason = plan.summary;
  }
  // Alerts always lead, whatever the score says.
  if (a && (a.level === 'emergency' || a.level === 'urgent')) reason = a.title;
  const readAt = state.readInbound[m.id];
  const unreadMsgs = state.inbound.filter((x) => x.motherId === m.id && (!readAt || x.receivedAt > readAt));
  const tiers = unreadMsgs.map((x) => state.inboundTriage[x.id] ?? safeTriage(x)).filter(Boolean) as TriageTier[];
  const triage = tiers.includes('emergency') ? 'emergency' : tiers.includes('same_day') ? 'same_day' : tiers.length ? 'next_contact' : undefined;
  // An unread message with danger signs lifts her up, even before anyone has opened it.
  let u = urgency;
  if (triage === 'emergency' && URGENCY_RANK[u] > URGENCY_RANK.urgent) {
    u = 'urgent';
    reason = 'She reported danger signs by message';
  }
  const { contacts, journey, children } = contactsFor(m, plan, state.clock);
  return {
    mother: m,
    plan,
    urgency: u,
    score: cp?.score ?? 0,
    reason,
    unread: unreadMsgs.length,
    triage,
    alert: a,
    alertChild: a?.childId ? children.find((c) => c.id === a.childId) : a?.subject === 'child' ? children[children.length - 1] : undefined,
    contacts,
    children,
    reading: readingFor(m, plan),
    journeyDay: journeyDayOf(m, plan, state.clock),
    journey,
    riskLevel: riskLevelOf(plan),
  };
}

function safeTriage(m: InboundMessage): TriageTier | undefined {
  try {
    return triageFor(m);
  } catch {
    return undefined;
  }
}

function journeyDayOf(m: Mother, plan: CarePlan, clock: string): number | undefined {
  const s = plan.state;
  if (s.stage === 'pregnancy') {
    const lmp = m.pregnancy?.lmp;
    const d = lmp ? daysBetween(lmp, clock) - 14 : (s.gestationalWeeks ?? 0) * 7 - 14;
    return Math.max(0, Math.min(266, d));
  }
  if (s.stage === 'postpartum' || s.stage === 'infant') return Math.min(1000, 266 + Math.max(0, s.infantAgeDays ?? s.daysPostpartum ?? 0));
  return undefined;
}

export function sortRows(rows: CaseRow[]): CaseRow[] {
  return rows.sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u) return u;
    if (b.score !== a.score) return b.score - a.score;
    const da = a.contacts[0]?.date ?? '9999';
    const db = b.contacts[0]?.date ?? '9999';
    return da < db ? -1 : da > db ? 1 : a.mother.name.localeCompare(b.mother.name);
  });
}

/** Every mother on this device with her row, most urgent first (no scope applied). */
export function useAllRows(): CaseRow[] {
  const { state } = useApp();
  const plans = usePlans();
  return useMemo(() => {
    const rows: CaseRow[] = [];
    for (const m of state.mothers) {
      const plan = plans.get(m.id);
      if (plan) rows.push(buildRow(state, m, plan));
    }
    return sortRows(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mothers, state.clock, state.inbound, state.readInbound, state.inboundTriage, plans]);
}

/** The rows in the acting worker's scope (her own caseload, her facility, or everyone). */
export function useScopedRows(): { rows: CaseRow[]; scope: Scope; setScope: (s: Scope) => void } {
  const worker = useWorker();
  const all = useAllRows();
  const [scope, setScope] = useScope(worker);
  const rows = useMemo(() => all.filter((r) => inScope(r.mother, scope, worker)), [all, scope, worker]);
  return { rows, scope, setScope };
}

// ---------- Fortnight schedule ----------

export interface DayBucket {
  date: string;
  contacts: Array<DueContact & { row: CaseRow }>;
  urgent: number;
}

/** The next `span` days from today; overdue contacts are gathered on today. */
export function fortnight(rows: CaseRow[], clock: string, span = 14): { days: DayBucket[]; overdue: Array<DueContact & { row: CaseRow }> } {
  const today = isoDay(clock);
  const days: DayBucket[] = Array.from({ length: span }, (_, i) => ({ date: isoDay(addDays(today, i)), contacts: [], urgent: 0 }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const overdue: Array<DueContact & { row: CaseRow }> = [];
  for (const row of rows) {
    for (const c of row.contacts) {
      const item = { ...c, row };
      if (c.overdueDays > 0 || c.date < today) {
        overdue.push(item);
        const d = byDate.get(today)!;
        d.contacts.push(item);
        d.urgent++;
        continue;
      }
      const d = byDate.get(c.date);
      if (!d) continue;
      d.contacts.push(item);
      if (row.urgency === 'emergency' || row.urgency === 'urgent') d.urgent++;
    }
  }
  // A mother with an emergency or urgent alert is due today, even if her routine contact is later.
  const t = byDate.get(today)!;
  for (const row of rows) {
    if ((row.urgency === 'emergency' || row.urgency === 'urgent') && !t.contacts.some((c) => c.motherId === row.mother.id)) {
      t.contacts.unshift({ motherId: row.mother.id, date: today, label: row.alert?.title ?? row.reason, kind: 'home', overdueDays: 0, row });
      t.urgent++;
    }
  }
  return { days, overdue };
}

// ---------- Replies from mothers ----------

export interface Reply {
  message: InboundMessage;
  row?: CaseRow;
  tier: TriageTier;
  unread: boolean;
}

export function useReplies(rows: CaseRow[]): Reply[] {
  const { state } = useApp();
  return useMemo(() => {
    const byId = new Map(rows.map((r) => [r.mother.id, r]));
    const out: Reply[] = [];
    for (const msg of state.inbound) {
      const row = byId.get(msg.motherId);
      if (!row) continue;
      const readAt = state.readInbound[msg.motherId];
      const unread = !readAt || msg.receivedAt > readAt;
      if (!unread) continue;
      out.push({ message: msg, row, tier: state.inboundTriage[msg.id] ?? safeTriage(msg) ?? 'next_contact', unread });
    }
    const rank: Record<TriageTier, number> = { emergency: 0, same_day: 1, next_contact: 2 };
    return out.sort((a, b) => rank[a.tier] - rank[b.tier] || (a.message.receivedAt < b.message.receivedAt ? 1 : -1));
  }, [state.inbound, state.readInbound, state.inboundTriage, rows]);
}

// ---------- What changed overnight ----------

export interface Overnight {
  newAlerts: number;
  plansChanged: number;
  replies: number;
  mothers: string[];
}

export function useOvernight(rows: CaseRow[]): Overnight {
  const { state } = useApp();
  return useMemo(() => {
    const since = addDays(state.clock, -1);
    const ids = new Set(rows.map((r) => r.mother.id));
    let newAlerts = 0;
    let plansChanged = 0;
    const mothers = new Set<string>();
    for (const [id, c] of Object.entries(state.lastChanges)) {
      if (!ids.has(id) || c.at < since) continue;
      plansChanged++;
      newAlerts += c.diff.newAlerts.length;
      mothers.add(id);
    }
    const replies = state.inbound.filter((m) => ids.has(m.motherId) && m.receivedAt >= since).length;
    return { newAlerts, plansChanged, replies, mothers: [...mothers] };
  }, [state.lastChanges, state.inbound, state.clock, rows]);
}

export function isNeedsNow(r: CaseRow): boolean {
  return r.urgency !== 'rest' || r.triage === 'emergency' || r.triage === 'same_day';
}

export const URGENCY_TONE: Record<Urgency, 'error' | 'warning' | 'brand' | 'gray'> = {
  emergency: 'error',
  urgent: 'warning',
  overdue: 'warning',
  today: 'brand',
  rest: 'gray',
};

export function useWorkerAndClock() {
  const { state } = useApp();
  const worker = useWorker();
  return { worker, clock: state.clock };
}
