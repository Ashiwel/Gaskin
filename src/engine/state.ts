import type { ChildState, JourneyStage, Mother, PatientState } from '../types';
import { computeAlerts, type AlertWithShort } from './alerts';
import { daysBetween } from './dates';
import { type Facts, ancVisits, collectFacts, feedingFor, labNumber, latestBp, latestEpds, latestFeeding, latestLab, latestVital, ofKind, recentSymptoms, growthFor } from './facts';
import { childRisks, computeRisks } from './risks';
import { activeConstraints, computeUnknowns } from './constraints';
import { milestoneMonthsDue } from './children';
import { ancPlan, immunisationStatus, pncContacts } from './schedule';

export function stageOf(f: Facts): JourneyStage {
  if (f.pregnant) return 'pregnancy';
  if (f.daysSinceBirth !== undefined && f.daysSinceBirth >= 0 && f.daysSinceBirth <= 42) return 'postpartum';
  if (f.youngestAgeDays !== undefined && f.youngestAgeDays > 42 && f.youngestAgeDays <= 1000) return 'infant';
  return 'preconception';
}

export function deriveState(mother: Mother, asOf: string): PatientState {
  const f = collectFacts(mother, asOf);
  return stateFromFacts(f, computeAlerts(f));
}

export function stateFromFacts(f: Facts, alerts: AlertWithShort[]): PatientState {
  const stage = stageOf(f);
  const bp = latestBp(f);
  const weight = latestVital(f, 'weightKg');
  const epds = latestEpds(f);
  const feeding = latestFeeding(f, f.youngest?.id);
  const child = f.youngest;
  const infantWeights = child ? growthFor(f, child).filter((g) => g.weightKg !== undefined) : [];
  const ga = f.ga;
  const state: PatientState = {
    motherId: f.mother.id,
    asOf: f.asOf,
    stage,
    trimester: ga === undefined ? undefined : ga < 14 ? 1 : ga < 28 ? 2 : 3,
    gestationalWeeks: ga,
    edd: f.edd,
    daysPostpartum: !f.pregnant && f.daysSinceBirth !== undefined ? f.daysSinceBirth : undefined,
    infantAgeDays: child && !f.pregnant ? f.youngestAgeDays : child && f.youngestAgeDays! <= 1000 ? f.youngestAgeDays : undefined,
    infant: child && f.youngestAgeDays! <= 1000 ? child : undefined,
    latest: {
      systolic: bp?.systolic,
      diastolic: bp?.diastolic,
      haemoglobin: labNumber(latestLab(f, 'haemoglobin')),
      weightKg: weight?.weightKg,
      epds: epds?.score,
      milkSupply: feeding?.milkSupply,
      infantWeightKg: infantWeights.length ? infantWeights[infantWeights.length - 1].weightKg : undefined,
    },
    recentSymptoms: (() => {
      const r = recentSymptoms(f, 7);
      return [...r.mother, ...r.baby];
    })(),
    ancContactsAttended: f.pregnant ? ancVisits(f).length : 0,
    risks: computeRisks(f),
    children: childStates(f),
    concurrent: f.concurrent || undefined,
    interpregnancyMonths: f.interpregnancyDays !== undefined ? Math.floor(f.interpregnancyDays / 30.4) : undefined,
  };
  const unknowns = computeUnknowns(f);
  if (unknowns.length) state.unknowns = unknowns;
  const cons = activeConstraints(f).map((x) => ({ itemId: x.itemId, reason: x.reason, at: x.at, ...(x.childId ? { childId: x.childId } : {}) }));
  if (cons.length) state.constraints = cons;
  state.contactPriority = contactPriority(f, state, alerts);
  return state;
}

/**
 * Who to contact next. Higher score = sooner. Weights favour safety first
 * (open danger signs), then the narrow postnatal window where most maternal and
 * newborn deaths happen, then overdue care, then risk and silence.
 */
export function contactPriority(f: Facts, s: PatientState, alerts: AlertWithShort[]): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const push = (pts: number, reason: string) => {
    score += pts;
    reasons.push(reason);
  };

  const emergencies = alerts.filter((a) => a.alert.level === 'emergency');
  const urgent = alerts.filter((a) => a.alert.level === 'urgent');
  const warnings = alerts.filter((a) => a.alert.level === 'warning');
  if (emergencies.length) push(100 + 10 * (emergencies.length - 1), `Emergency: ${emergencies.map((a) => a.finding).join('; ')}`);
  if (urgent.length) push(50 + 5 * (urgent.length - 1), `Urgent: ${urgent.map((a) => a.finding).join('; ')}`);
  if (warnings.length) push(15, `Follow-up: ${warnings.map((a) => a.finding).join('; ')}`);

  // Postnatal day 0–7: the highest-risk window for mother and baby.
  if (s.stage === 'postpartum' && s.daysPostpartum !== undefined && s.daysPostpartum <= 7) push(35 - s.daysPostpartum * 2, `Day ${s.daysPostpartum} after birth`);

  // Overdue or missed contacts.
  const anc = ancPlan(f);
  if (anc?.next && anc.next.overdueDays > 0) push(Math.min(30, 10 + anc.next.overdueDays), `ANC contact ${anc.next.contactNumber} overdue by ${anc.next.overdueDays} days`);
  if (anc?.next?.lateBooking) push(15, `Not yet booked for ANC at ${s.gestationalWeeks} weeks`);
  const pnc = pncContacts(f);
  const pncLate = pnc?.filter((c) => c.status === 'overdue' || c.status === 'missed') ?? [];
  if (pncLate.length) push(20 + 5 * (pncLate.length - 1), `${pncLate.map((c) => c.label.replace('Postnatal check ', 'PNC ')).join(', ')} not done`);
  const pncDue = pnc?.find((c) => c.status === 'due');
  if (pncDue) push(15, `${pncDue.label} due now`);
  // Every child under 1,000 days: the most overdue vaccine visit counts once.
  const lateKids = f.under1000
    .map((ch) => ({ ch, imm: immunisationStatus(f, ch) }))
    .filter((x) => x.imm.next && x.imm.next.overdueDays > 14)
    .sort((a, b) => b.imm.next!.overdueDays - a.imm.next!.overdueDays);
  if (lateKids.length) {
    const top = lateKids[0];
    push(Math.min(20, 8 + Math.floor(top.imm.next!.overdueDays / 7)) + 4 * (lateKids.length - 1), lateKids.map((x) => `${x.ch.name}: ${x.imm.next!.label} vaccines ${x.imm.next!.overdueDays} days overdue`).join('; '));
  }
  if (s.unknowns?.some((u) => u.action === 'refer_for_test')) push(25, `Not tested: ${s.unknowns.filter((u) => u.action === 'refer_for_test').map((u) => u.test).join(', ')}`);

  // Missed visits (recorded as not attended) in the last 30 days.
  const missed = ofKind(f, 'visit').filter((v) => !v.attended && daysBetween(v.at, f.asOf) <= 30);
  if (missed.length) push(10 * missed.length, `Missed ${missed.length} visit${missed.length > 1 ? 's' : ''} in the last month`);

  // Unanswered self-reports: a message from her with no worker contact since.
  const lastSelfReport = [...f.events].reverse().find((e) => e.recordedBy === 'mother');
  if (lastSelfReport) {
    const answered = f.events.some((e) => e.recordedBy !== 'mother' && e.recordedBy !== 'system' && e.at > lastSelfReport.at);
    if (!answered) push(20, `Her message from ${daysBetween(lastSelfReport.at, f.asOf) === 0 ? 'today' : `${daysBetween(lastSelfReport.at, f.asOf)} days ago`} has no reply`);
  }

  // High-risk factors (cap so risk alone never outranks an alert).
  const highRisks = s.risks.filter((r) => r.severity === 'urgent' || r.severity === 'high');
  if (highRisks.length) push(Math.min(20, 6 * highRisks.length), `High risk: ${highRisks.slice(0, 3).map((r) => r.label.toLowerCase()).join(', ')}`);

  // Silence: days since the last worker contact.
  const lastContact = [...f.events].reverse().find((e) => e.recordedBy !== 'mother' && e.recordedBy !== 'system' && (e.kind === 'visit' ? e.attended : true));
  const silent = lastContact ? daysBetween(lastContact.at, f.asOf) : daysBetween(f.mother.enrolledAt, f.asOf);
  const silenceLimit = s.stage === 'postpartum' ? 7 : s.stage === 'pregnancy' ? 28 : 45;
  if (silent > silenceLimit) push(Math.min(15, Math.floor(silent / 7)), `No contact for ${silent} days`);

  return { score: Math.round(score), reasons };
}

/** One entry per child under 1,000 days, oldest first. */
export function childStates(f: Facts): ChildState[] {
  return f.under1000.map((child) => {
    const ageDays = daysBetween(child.dob, f.asOf);
    const corrected = child.gestationAtBirthWeeks < 37 && ageDays < 730 ? Math.max(0, ageDays - (40 - child.gestationAtBirthWeeks) * 7) : undefined;
    const weights = growthFor(f, child).filter((g) => g.weightKg !== undefined);
    const muacs = growthFor(f, child).filter((g) => g.muacCm !== undefined);
    const lastW = weights[weights.length - 1];
    const imm = immunisationStatus(f, child);
    const feeds = feedingFor(f, child);
    return {
      childId: child.id,
      name: child.name,
      sex: child.sex,
      dob: child.dob,
      ageDays,
      correctedAgeDays: corrected,
      feeding: feeds.length ? feeds[feeds.length - 1].status : child.feeding,
      twin: f.children.some((c) => c.id !== child.id && c.dob.slice(0, 10) === child.dob.slice(0, 10)),
      latestWeightKg: lastW?.weightKg,
      latestWeightAt: lastW?.at.slice(0, 10),
      latestMuacCm: muacs.length ? muacs[muacs.length - 1].muacCm : undefined,
      immunisation: { next: imm.next, overdue: imm.overdue },
      milestonesDueMonths: milestoneMonthsDue(corrected ?? ageDays),
      risks: childRisks(f, child),
    };
  });
}
