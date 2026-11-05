import type { Child, NextContact, VisitEvent } from '../types';
import { IMMUNISATION_SCHEDULES, VACCINE_NAMES, vaccineKey } from '../clinical';
import { addDays, daysBetween, dayMs, gestationalWeeks, shortDate } from './dates';
import { type Facts, ancVisits, ofKind, vaccinesGiven } from './facts';

// ---------- ANC: WHO 2016 eight-contact model (rec. E.7), adopted by Nigeria (MCSP 2018) ----------

export const ANC_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];

export interface AncPlan {
  attended: number;
  lastVisitGa?: number;
  next?: { contactNumber: number; week: number; due: string; overdueDays: number; lateBooking: boolean; missedWeek?: number };
  remaining: Array<{ week: number; due: string }>;
}

export function ancPlan(f: Facts): AncPlan | undefined {
  if (!f.pregnant || !f.lmp || f.ga === undefined) return undefined;
  const visits = ancVisits(f);
  const attended = visits.length;
  const last = visits[visits.length - 1];
  const lastVisitGa = last ? gestationalWeeks(f.lmp, last.at) : undefined;
  const dueFor = (w: number) => addDays(f.lmp!, w * 7);

  let next: AncPlan['next'];
  if (attended === 0) {
    // Not yet booked: contact 1 due by 12 weeks, or now if later.
    const due = f.ga <= 12 ? dueFor(12) : f.asOf;
    next = { contactNumber: 1, week: Math.max(12, f.ga), due, overdueDays: 0, lateBooking: f.ga > 12 };
  } else {
    // Next scheduled week after the last attended contact (allow a contact up to 1 week early to count).
    const w = ANC_WEEKS.find((x) => x > (lastVisitGa ?? 0) + 1);
    if (w !== undefined && w < f.ga - 1) {
      // Scheduled week long passed: she is due now, at her current gestation.
      next = { contactNumber: attended + 1, week: f.ga, due: f.asOf, overdueDays: daysBetween(dueFor(w), f.asOf), lateBooking: false, missedWeek: w };
    } else if (w !== undefined) {
      const due = dueFor(w);
      next = { contactNumber: attended + 1, week: w, due, overdueDays: Math.max(0, daysBetween(due, f.asOf)), lateBooking: false };
    } else if (f.ga >= 40) {
      const due = dueFor(41); // WHO: return at 41 weeks if not delivered
      next = { contactNumber: attended + 1, week: 41, due, overdueDays: Math.max(0, daysBetween(due, f.asOf)), lateBooking: false };
    }
  }
  const ga = f.ga;
  const remaining = ANC_WEEKS.filter((w) => w > Math.max(ga, next?.week ?? 0)).map((w) => ({ week: w, due: dueFor(w) }));
  return { attended, lastVisitGa, next, remaining };
}

// ---------- PNC: WHO 2022 rec. 44, at least four contacts ----------

export interface PncContact {
  id: 'visit.pnc_24h' | 'visit.pnc_day3' | 'visit.pnc_day7_14' | 'visit.pnc_6wk';
  label: string;
  /** Window in days after birth */
  start: number;
  end: number;
  due: string;
  status: 'done' | 'due' | 'upcoming' | 'missed' | 'overdue';
  doneOn?: string;
}

const PNC_DEFS: Array<Pick<PncContact, 'id' | 'label' | 'start' | 'end'>> = [
  { id: 'visit.pnc_24h', label: 'Postnatal check within 24 hours', start: 0, end: 1 },
  { id: 'visit.pnc_day3', label: 'Postnatal check at 48–72 hours (day 2–3)', start: 2, end: 3 },
  { id: 'visit.pnc_day7_14', label: 'Postnatal check at day 7–14', start: 7, end: 14 },
  { id: 'visit.pnc_6wk', label: 'Postnatal check at 6 weeks', start: 42, end: 49 },
];

const PNC_VISIT_TYPES: VisitEvent['visitType'][] = ['pnc', 'home_visit', 'child_health', 'emergency'];

export function pncContacts(f: Facts): PncContact[] | undefined {
  if (!f.lastBirth || f.daysSinceBirth === undefined || f.daysSinceBirth < 0 || f.daysSinceBirth > 56) return undefined;
  const birth = f.lastBirth.date;
  const visits = ofKind(f, 'visit').filter((v) => v.attended && PNC_VISIT_TYPES.includes(v.visitType) && dayMs(v.at) >= dayMs(birth));
  const used = new Set<string>();
  const d = f.daysSinceBirth;
  return PNC_DEFS.map((def, i) => {
    // A visit counts for a contact if it falls inside the window (a day of slack after it).
    const hit = visits.find((v) => {
      const day = daysBetween(birth, v.at);
      return !used.has(v.id) && day >= def.start && day <= def.end + (i === 0 ? 0 : 2);
    });
    if (hit) used.add(hit.id);
    const due = addDays(birth, def.start);
    let status: PncContact['status'];
    if (hit) status = 'done';
    else if (d < def.start) status = 'upcoming';
    else if (d <= def.end) status = 'due';
    else {
      // Window passed: missed if a later contact has opened since, else still overdue.
      const nextDef = PNC_DEFS[i + 1];
      status = nextDef && d >= nextDef.start ? 'missed' : 'overdue';
    }
    return { ...def, due, status, doneOn: hit?.at.slice(0, 10) };
  });
}

// ---------- Immunisation ----------

export interface ImmunisationStatus {
  child: Child;
  /** Earliest schedule visit with any dose still missing */
  next?: { label: string; due: string; missing: string[]; overdueDays: number };
  /** All doses that were due before today and are not recorded */
  overdue: string[];
}

export function immunisationStatus(f: Facts, child: Child): ImmunisationStatus {
  const given = new Set(vaccinesGiven(f, child).map(vaccineKey));
  const sched = IMMUNISATION_SCHEDULES[f.mother.country];
  const age = daysBetween(child.dob, f.asOf);
  const overdue: string[] = [];
  let next: ImmunisationStatus['next'];
  for (const visit of sched) {
    const missing = visit.vaccines.filter((v) => !given.has(vaccineKey(v)));
    if (missing.length === 0) continue;
    // Birth doses: BCG is given up to 11 months; OPV0 only before 2 weeks; HepB0 within 24 h (catch-up not routine).
    const stillUseful = missing.filter((v) => {
      const k = vaccineKey(v);
      if (k === 'OPV0') return age <= 14;
      if (k === 'HEPB0') return age <= 14;
      if (k === 'BCG') return age <= 335;
      return true;
    });
    if (stillUseful.length === 0) continue;
    const due = addDays(child.dob, visit.ageDays);
    if (visit.ageDays <= age) overdue.push(...stillUseful);
    if (!next) next = { label: visit.label, due, missing: stillUseful, overdueDays: Math.max(0, age - visit.ageDays) };
  }
  return { child, next, overdue };
}

export function vaccineList(codes: string[]): string {
  return codes
    .map((c) => {
      const base = c.split(' ')[0];
      const m = base.match(/^([A-Za-z-]+?)(\d*)$/);
      const name = VACCINE_NAMES[base] ?? (m ? VACCINE_NAMES[m[1]] : undefined);
      const extra = c.includes('(') ? ` ${c.slice(c.indexOf('('))}` : '';
      return name ? `${name}${m && m[2] && !VACCINE_NAMES[base] ? ` ${m[2]}` : ''}${extra}` : c;
    })
    .join(', ');
}

// ---------- Next contact ----------

export function nextContact(f: Facts): NextContact | undefined {
  const anc = ancPlan(f);
  if (anc?.next) {
    const n = anc.next;
    return {
      date: n.due,
      type: 'anc',
      label: n.contactNumber === 1 ? `ANC booking (contact 1)${n.lateBooking ? ', due now' : ', by 12 weeks'}` : n.missedWeek ? `ANC contact ${n.contactNumber} (missed ${n.missedWeek}-week contact)` : `ANC contact ${n.contactNumber} (${n.week} weeks)`,
    };
  }
  const pnc = pncContacts(f);
  const open = pnc?.find((c) => c.status === 'due' || c.status === 'overdue') ?? pnc?.find((c) => c.status === 'upcoming');
  if (open) return { date: open.due, type: f.daysSinceBirth! <= 14 ? 'home_visit' : 'pnc', label: open.label };
  const child = f.youngest;
  if (child && f.youngestAgeDays !== undefined && f.youngestAgeDays <= 1000) {
    const imm = immunisationStatus(f, child);
    if (imm.next) return { date: imm.next.overdueDays > 0 ? f.asOf : imm.next.due, type: 'child_health', label: `${child.name}: ${imm.next.label} vaccines${imm.next.overdueDays > 0 ? ' (overdue)' : ''}` };
    // Growth monitoring monthly to 2 years.
    const lastGrowth = [...ofKind(f, 'growth')].reverse()[0];
    const due = lastGrowth ? addDays(lastGrowth.at, 30) : f.asOf;
    return { date: due, type: 'child_health', label: `${child.name}: growth check` };
  }
  // Preconception: a check-in every 3 months.
  const lastVisit = [...ofKind(f, 'visit')].reverse().find((v) => v.attended);
  return { date: lastVisit ? addDays(lastVisit.at, 90) : f.asOf, type: 'home_visit', label: 'Preconception and family planning check-in' };
}

export function contactLabelWithDate(c: NextContact, asOf: string): string {
  const diff = daysBetween(asOf, c.date);
  const when = diff === 0 ? 'today' : diff < 0 ? `overdue since ${shortDate(c.date)}` : diff === 1 ? 'tomorrow' : shortDate(c.date);
  return `${c.label}: ${when}`;
}
