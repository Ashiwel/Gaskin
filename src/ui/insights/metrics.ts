/**
 * Insights figures, all computed on the device from the mothers in the signed-in worker's scope by
 * the same rules that build their plans: current metrics, twelve-week trends from the event log,
 * the care cascade, and the de-identified public table with small-number suppression.
 */
import type { CarePlan, Channel, Mother } from '../../types';
import { daysBetween } from '../format';

/** Recommended ANC contacts by gestational week (WHO 2016, 8 contacts). */
const ANC_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];
const expectedAnc = (weeks?: number) => (weeks === undefined ? 0 : ANC_WEEKS.filter((w) => w <= weeks).length);

export interface Metrics {
  enrolled: number;
  byStage: Record<string, number>;
  risk: { danger: number; high: number; moderate: number; low: number };
  highRisk: number;
  openAlerts: number;
  emergencyAlerts: number;
  referralsOpen: number;
  referralsDone: number;
  referralsNotCompleted: number;
  ancAttended: number;
  ancExpected: number;
  pncEligible: number;
  pnc48: number;
  ebfEligible: number;
  ebf: number;
  epdsEligible: number;
  epdsScreened: number;
  epdsPositive: number;
  immDue: number;
  immOnTime: number;
  messages: number;
  costByChannel: Record<string, { usd: number; count: number }>;
  costTotalUSD: number;
  costPerMotherMonthUSD: number;
  overrides: number;
  rulesLearned: number;
  proposalsOpen: number;
  cascade: { delivered: number; anc4: number; facilityBirth: number; pnc48: number; immunised: number };
}

interface Ctx {
  clock: string;
  outbound: { motherId: string; channel: Channel; estCostUSD: number; createdAt: string }[];
  overrides: { motherId: string }[];
  learnedRules: unknown[];
  proposals: { status: string }[];
}

function birthOf(m: Mother): { date: string; place: string; at: string } | null {
  const e = m.events.find((x) => x.kind === 'birth');
  if (e && e.kind === 'birth') return { date: e.birth.date, place: e.birth.place, at: e.at };
  if (m.birth) return { date: m.birth.date, place: m.birth.place, at: m.birth.date };
  return null;
}

function pncWithin48(m: Mother, birthDate: string): boolean {
  return m.events.some((e) => e.kind === 'visit' && e.visitType === 'pnc' && e.attended && daysBetween(birthDate, e.at) <= 2 && daysBetween(birthDate, e.at) >= 0);
}

export function computeMetrics(mothers: Mother[], plans: Map<string, CarePlan>, ctx: Ctx): Metrics {
  const ids = new Set(mothers.map((m) => m.id));
  const m: Metrics = {
    enrolled: mothers.length,
    byStage: { preconception: 0, pregnancy: 0, postpartum: 0, infant: 0 },
    risk: { danger: 0, high: 0, moderate: 0, low: 0 },
    highRisk: 0,
    openAlerts: 0,
    emergencyAlerts: 0,
    referralsOpen: 0,
    referralsDone: 0,
    referralsNotCompleted: 0,
    ancAttended: 0,
    ancExpected: 0,
    pncEligible: 0,
    pnc48: 0,
    ebfEligible: 0,
    ebf: 0,
    epdsEligible: 0,
    epdsScreened: 0,
    epdsPositive: 0,
    immDue: 0,
    immOnTime: 0,
    messages: 0,
    costByChannel: {},
    costTotalUSD: 0,
    costPerMotherMonthUSD: 0,
    overrides: ctx.overrides.filter((o) => ids.has(o.motherId)).length,
    rulesLearned: ctx.learnedRules.length,
    proposalsOpen: ctx.proposals.filter((p) => p.status === 'pending' || p.status === 'needs_evidence').length,
    cascade: { delivered: 0, anc4: 0, facilityBirth: 0, pnc48: 0, immunised: 0 },
  };
  for (const mo of mothers) {
    const plan = plans.get(mo.id);
    if (!plan) continue;
    const s = plan.state;
    m.byStage[s.stage] = (m.byStage[s.stage] ?? 0) + 1;
    const sev = s.risks.map((r) => r.severity);
    if (plan.alerts.some((a) => a.level === 'emergency' || a.level === 'urgent') || sev.includes('urgent')) m.risk.danger += 1;
    else if (sev.includes('high')) m.risk.high += 1;
    else if (sev.includes('moderate')) m.risk.moderate += 1;
    else m.risk.low += 1;
    if (s.risks.some((r) => r.severity === 'high' || r.severity === 'urgent')) m.highRisk += 1;
    m.openAlerts += plan.alerts.length;
    m.emergencyAlerts += plan.alerts.filter((a) => a.level === 'emergency').length;
    for (const e of mo.events) {
      if (e.kind === 'referral') {
        if (e.status === 'completed' || e.status === 'arrived') m.referralsDone += 1;
        else if (e.status === 'open') m.referralsOpen += 1;
        else m.referralsNotCompleted += 1;
      }
    }
    if (s.stage === 'pregnancy') {
      m.ancAttended += Math.min(s.ancContactsAttended, 8);
      m.ancExpected += Math.max(expectedAnc(s.gestationalWeeks), Math.min(s.ancContactsAttended, 8));
    }
    const birth = birthOf(mo);
    if (birth && (s.stage === 'postpartum' || s.stage === 'infant')) {
      if (daysBetween(birth.date, ctx.clock) >= 2) {
        m.pncEligible += 1;
        if (pncWithin48(mo, birth.date)) m.pnc48 += 1;
      }
    }
    if (birth) {
      m.cascade.delivered += 1;
      const ancs = mo.events.filter((e) => e.kind === 'visit' && e.visitType === 'anc' && e.attended && e.at <= birth.at).length;
      if (ancs >= 4) m.cascade.anc4 += 1;
      if (birth.place === 'facility') m.cascade.facilityBirth += 1;
      if (pncWithin48(mo, birth.date)) m.cascade.pnc48 += 1;
    }
    if (s.infant && (s.infantAgeDays ?? 999) < 183) {
      m.ebfEligible += 1;
      if (s.infant.feeding === 'exclusive_breastfeeding') m.ebf += 1;
    }
    if (s.stage === 'postpartum' || s.stage === 'infant' || (s.stage === 'pregnancy' && (s.gestationalWeeks ?? 0) >= 28)) {
      m.epdsEligible += 1;
      const sc = mo.events.filter((e) => e.kind === 'screening' && e.instrument === 'epds');
      if (sc.length) {
        m.epdsScreened += 1;
        const last = [...sc].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
        if (last.kind === 'screening' && (last.score >= 13 || last.selfHarmFlag)) m.epdsPositive += 1;
      }
    }
    if (s.infant) {
      const age = s.infantAgeDays ?? 0;
      const given = mo.events.filter((e) => e.kind === 'immunisation').length;
      // Birth, 6, 10, 14 weeks, 9 months: doses due by now.
      const due = [0, 42, 70, 98, 274].filter((d) => d + 14 <= age).length;
      if (due) {
        m.immDue += 1;
        if (given >= due) {
          m.immOnTime += 1;
          if (birth) m.cascade.immunised += 1;
        }
      } else if (birth && given > 0) m.cascade.immunised += 1;
    }
  }
  const msgs = ctx.outbound.filter((o) => ids.has(o.motherId));
  m.messages = msgs.length;
  for (const o of msgs) {
    const c = (m.costByChannel[o.channel] ??= { usd: 0, count: 0 });
    c.usd += o.estCostUSD;
    c.count += 1;
  }
  m.costTotalUSD = msgs.reduce((s, o) => s + o.estCostUSD, 0);
  const first = msgs.reduce((a, o) => (o.createdAt < a ? o.createdAt : a), ctx.clock);
  const months = Math.max(1, daysBetween(first, ctx.clock) / 30.44);
  m.costPerMotherMonthUSD = mothers.length ? m.costTotalUSD / mothers.length / months : 0;
  return m;
}

// ---------- Twelve-week trends ----------

export interface Trends {
  labels: string[];
  pnc48: number[];
  ancContacts: number[];
  referrals: number[];
  messages: number[];
  costPerMother: number[];
  overrides: number[];
}

/** Weekly series from the event log, oldest first (each value is the week ending on that label). */
export function weeklyTrends(mothers: Mother[], ctx: { clock: string; outbound: Ctx['outbound']; overrides: Array<{ motherId: string; createdAt: string }> }, weeks = 12): Trends {
  const end = new Date(ctx.clock).getTime();
  const DAY = 86_400_000;
  const ids = new Set(mothers.map((m) => m.id));
  const t: Trends = { labels: [], pnc48: [], ancContacts: [], referrals: [], messages: [], costPerMother: [], overrides: [] };
  for (let w = weeks - 1; w >= 0; w--) {
    const hi = end - w * 7 * DAY;
    const lo = hi - 7 * DAY;
    const hiIso = new Date(hi).toISOString();
    t.labels.push(new Date(hi).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
    let eligible = 0;
    let ok = 0;
    let anc = 0;
    let refs = 0;
    for (const m of mothers) {
      const b = birthOf(m);
      if (b && daysBetween(b.date, hiIso) >= 2) {
        eligible += 1;
        if (m.events.some((e) => e.kind === 'visit' && e.visitType === 'pnc' && e.attended && e.at <= hiIso && daysBetween(b.date, e.at) <= 2 && daysBetween(b.date, e.at) >= 0)) ok += 1;
      }
      for (const e of m.events) {
        const at = new Date(e.at).getTime();
        if (at <= lo || at > hi) continue;
        if (e.kind === 'visit' && e.visitType === 'anc' && e.attended) anc += 1;
        if (e.kind === 'referral') refs += 1;
      }
    }
    t.pnc48.push(eligible ? Math.round((ok / eligible) * 100) : NaN);
    t.ancContacts.push(anc);
    t.referrals.push(refs);
    const inWeek = ctx.outbound.filter((o) => ids.has(o.motherId) && new Date(o.createdAt).getTime() > lo && new Date(o.createdAt).getTime() <= hi);
    t.messages.push(inWeek.length);
    const upTo = ctx.outbound.filter((o) => ids.has(o.motherId) && new Date(o.createdAt).getTime() <= hi);
    t.costPerMother.push(mothers.length ? +(upTo.reduce((s, o) => s + o.estCostUSD, 0) / mothers.length).toFixed(4) : 0);
    t.overrides.push(ctx.overrides.filter((o) => ids.has(o.motherId) && new Date(o.createdAt).getTime() <= hi).length);
  }
  // Weeks before any birth have no rate: carry the nearest known value so the line does not dive to 0.
  const firstKnown = t.pnc48.find((v) => !Number.isNaN(v)) ?? 0;
  let last = firstKnown;
  t.pnc48 = t.pnc48.map((v) => (Number.isNaN(v) ? last : (last = v)));
  return t;
}

/** Change over the last four weeks of a series. */
export function delta4(series: number[]): number {
  if (series.length < 5) return 0;
  return +(series[series.length - 1] - series[series.length - 5]).toFixed(2);
}

// ---------- Public, de-identified figures ----------

export const SUPPRESS_BELOW = 10;

export interface PublicRow {
  key: string;
  label: string;
  group: string;
  /** Shown value, or null when withheld */
  value: string | null;
  raw: number | null;
  denominator?: number | null;
  suppressed: boolean;
  reason?: string;
}

const small = (n: number) => n > 0 && n < SUPPRESS_BELOW;

function countRow(group: string, key: string, label: string, n: number): PublicRow {
  return small(n) ? { group, key, label, value: null, raw: null, suppressed: true, reason: `Between 1 and ${SUPPRESS_BELOW - 1}` } : { group, key, label, value: n.toLocaleString('en-GB'), raw: n, suppressed: false };
}

/** A rate is withheld when the denominator is under the threshold, or the numerator or the rest is small. */
function rateRow(group: string, key: string, label: string, num: number, den: number): PublicRow {
  const ok = den >= SUPPRESS_BELOW && !small(num) && !small(den - num);
  const pctV = den ? Math.round((num / den) * 100) : 0;
  return ok
    ? { group, key, label, value: `${pctV}%`, raw: pctV, denominator: den, suppressed: false }
    : { group, key, label, value: null, raw: null, denominator: small(den) ? null : den, suppressed: true, reason: den < SUPPRESS_BELOW ? `Fewer than ${SUPPRESS_BELOW} mothers` : 'Would reveal a small count' };
}

export function publicRows(m: Metrics): PublicRow[] {
  const rows: PublicRow[] = [
    countRow('Reach', 'mothers_enrolled', 'Mothers enrolled', m.enrolled),
    countRow('Reach', 'stage_pregnancy', 'Pregnant', m.byStage.pregnancy ?? 0),
    countRow('Reach', 'stage_postpartum', 'After birth (first 6 weeks)', m.byStage.postpartum ?? 0),
    countRow('Reach', 'stage_infant', 'With a baby under 2', m.byStage.infant ?? 0),
    countRow('Reach', 'stage_preconception', 'Before pregnancy', m.byStage.preconception ?? 0),
    rateRow('Continuity of care', 'pnc_within_48h', 'Postnatal check within 48 hours', m.pnc48, m.pncEligible),
    rateRow('Continuity of care', 'anc4_among_delivered', 'Four or more antenatal contacts (among births)', m.cascade.anc4, m.cascade.delivered),
    rateRow('Continuity of care', 'facility_births', 'Births in a health facility', m.cascade.facilityBirth, m.cascade.delivered),
    rateRow('Continuity of care', 'anc_contacts_kept', 'Antenatal contacts kept, of those due', m.ancAttended, m.ancExpected),
    rateRow('Continuity of care', 'exclusive_breastfeeding_under_6m', 'Breast milk only, babies under 6 months', m.ebf, m.ebfEligible),
    rateRow('Continuity of care', 'epds_screened', 'Mood check done', m.epdsScreened, m.epdsEligible),
    rateRow('Continuity of care', 'immunisation_on_time', 'Vaccines on time', m.immOnTime, m.immDue),
    countRow('Safety', 'open_danger_alerts', 'Open danger alerts', m.openAlerts),
    countRow('Safety', 'referrals_open', 'Referrals open', m.referralsOpen),
    countRow('Safety', 'referrals_completed', 'Referrals completed', m.referralsDone),
    countRow('Messaging', 'messages_sent', 'Messages sent', m.messages),
    m.enrolled >= SUPPRESS_BELOW
      ? { group: 'Messaging', key: 'cost_per_mother_per_month_usd', label: 'Messaging cost per mother a month (US$)', value: `$${m.costPerMotherMonthUSD.toFixed(3)}`, raw: +m.costPerMotherMonthUSD.toFixed(4), suppressed: false }
      : { group: 'Messaging', key: 'cost_per_mother_per_month_usd', label: 'Messaging cost per mother a month (US$)', value: null, raw: null, suppressed: true, reason: `Fewer than ${SUPPRESS_BELOW} mothers` },
    countRow('Learning', 'expert_overrides', 'Plan changes by health workers', m.overrides),
    countRow('Learning', 'rules_learned', 'Rules learned from experts', m.rulesLearned),
  ];
  // Secondary suppression: with exactly one stage withheld, the total minus the others gives it away.
  const stages = rows.filter((r) => r.key.startsWith('stage_'));
  const hidden = stages.filter((r) => r.suppressed);
  if (hidden.length === 1 && !rows[0].suppressed) {
    const next = stages.filter((r) => !r.suppressed && (r.raw ?? 0) > 0).sort((a, b) => (a.raw ?? 0) - (b.raw ?? 0))[0];
    if (next) Object.assign(next, { value: null, raw: null, suppressed: true, reason: 'Would reveal a withheld count' });
  }
  return rows;
}

export function publicJSON(rows: PublicRow[], meta: { clock: string; area: string }) {
  return {
    publisher: 'Gaskin open data (synthetic demo)',
    generatedAt: meta.clock,
    area: meta.area,
    deidentified: true,
    suppressBelow: SUPPRESS_BELOW,
    note: `Counts from 1 to ${SUPPRESS_BELOW - 1} are withheld (null); rates are withheld when they would reveal such a count.`,
    metrics: Object.fromEntries(rows.map((r) => [r.key, r.suppressed ? { value: null, suppressed: true } : { value: r.raw, ...(r.denominator != null ? { denominator: r.denominator } : {}) }])),
  };
}
