import type {
  Birth,
  Child,
  ClinicalEvent,
  FeedingEvent,
  GrowthEvent,
  ImmunisationEvent,
  LabEvent,
  LabTest,
  MedicationEvent,
  Mother,
  ScreeningEvent,
  SymptomCode,
  SymptomEvent,
  VisitEvent,
  VitalsEvent,
} from '../types';
import { daysBetween, dayMs, eddFromLmp, gestationalWeeks, isoDate, timeMs } from './dates';

const DAY_MS = 86_400_000;

/**
 * Everything the rules need, pulled once from the mother's record and her
 * event timeline as of a given moment. Only events at or before `asOf` count,
 * so the same (mother, asOf) always gives the same answer.
 */
export interface Facts {
  mother: Mother;
  asOf: string; // ISO date (day precision)
  events: ClinicalEvent[]; // sorted oldest first, all at or before asOf
  pregnant: boolean;
  lmp?: string;
  ga?: number;
  edd?: string;
  lastBirth?: Birth;
  lastBirthChild?: Child;
  daysSinceBirth?: number;
  children: Child[];
  youngest?: Child;
  youngestAgeDays?: number;
  bmi?: number;
}

export function collectFacts(mother: Mother, asOf: string): Facts {
  // A date-only asOf means "end of that day".
  const cutoff = asOf.length <= 10 ? dayMs(asOf) + DAY_MS - 1 : timeMs(asOf);
  const day = isoDate(asOf);
  const events = mother.events
    .filter((e) => timeMs(e.at) <= cutoff)
    .slice()
    .sort((a, b) => timeMs(a.at) - timeMs(b.at) || a.id.localeCompare(b.id));

  // Births: from events and from the mother record, latest first.
  const births: Array<{ birth: Birth; child?: Child }> = [];
  for (const e of events) if (e.kind === 'birth') births.push({ birth: e.birth, child: e.child });
  if (mother.birth && dayMs(mother.birth.date) <= cutoff && !births.some((b) => b.birth.date.slice(0, 10) === mother.birth!.date.slice(0, 10))) {
    births.push({ birth: mother.birth, child: mother.children.find((c) => c.dob.slice(0, 10) === mother.birth!.date.slice(0, 10)) });
  }
  births.sort((a, b) => dayMs(a.birth.date) - dayMs(b.birth.date));
  const last = births[births.length - 1];

  const childMap = new Map<string, Child>();
  for (const c of mother.children) if (dayMs(c.dob) <= cutoff) childMap.set(c.id, c);
  for (const b of births) if (b.child && !childMap.has(b.child.id)) childMap.set(b.child.id, b.child);
  // Feeding status: latest feeding event per child overrides the record.
  for (const e of events) {
    if (e.kind === 'feeding' && e.childId && childMap.has(e.childId)) childMap.set(e.childId, { ...childMap.get(e.childId)!, feeding: e.status });
  }
  const children = [...childMap.values()].sort((a, b) => dayMs(a.dob) - dayMs(b.dob) || a.id.localeCompare(b.id));
  const youngest = children[children.length - 1];

  // Pregnancy is current when there is no birth on or after the LMP.
  const lmp = mother.pregnancy?.lmp;
  const pregnant = !!lmp && dayMs(lmp) <= cutoff && !(last && dayMs(last.birth.date) >= dayMs(lmp));

  const bmi =
    mother.heightCm && mother.prePregnancyWeightKg ? mother.prePregnancyWeightKg / Math.pow(mother.heightCm / 100, 2) : undefined;

  return {
    mother,
    asOf: day,
    events,
    pregnant,
    lmp: pregnant ? lmp : undefined,
    ga: pregnant && lmp ? gestationalWeeks(lmp, day) : undefined,
    edd: pregnant && lmp ? eddFromLmp(lmp) : undefined,
    lastBirth: last?.birth,
    lastBirthChild: last?.child,
    daysSinceBirth: last ? daysBetween(last.birth.date, day) : undefined,
    children,
    youngest,
    youngestAgeDays: youngest ? daysBetween(youngest.dob, day) : undefined,
    bmi: bmi ? Math.round(bmi * 10) / 10 : undefined,
  };
}

// ---------- Event queries ----------

export function ofKind<K extends ClinicalEvent['kind']>(f: Facts, kind: K): Extract<ClinicalEvent, { kind: K }>[] {
  return f.events.filter((e) => e.kind === kind) as Extract<ClinicalEvent, { kind: K }>[];
}

/** Age of an event in whole days relative to asOf (0 = today). */
export function ageDays(f: Facts, e: { at: string }): number {
  return daysBetween(e.at, f.asOf);
}

export function isRecent(f: Facts, e: { at: string }, days: number): boolean {
  const a = ageDays(f, e);
  return a >= 0 && a <= days;
}

/** Maternal vitals (no childId). */
export function maternalVitals(f: Facts): VitalsEvent[] {
  return ofKind(f, 'vitals').filter((v) => !v.childId);
}

export function latestBp(f: Facts): VitalsEvent | undefined {
  return [...maternalVitals(f)].reverse().find((v) => v.systolic !== undefined && v.diastolic !== undefined);
}

export function latestVital(f: Facts, field: keyof VitalsEvent, childId?: string): VitalsEvent | undefined {
  return [...ofKind(f, 'vitals')]
    .reverse()
    .find((v) => v[field] !== undefined && (childId ? v.childId === childId : !v.childId));
}

export function latestLab(f: Facts, test: LabTest, sinceIso?: string): LabEvent | undefined {
  return [...ofKind(f, 'lab')].reverse().find((l) => l.test === test && (!sinceIso || dayMs(l.at) >= dayMs(sinceIso)));
}

export function labNumber(l: LabEvent | undefined): number | undefined {
  if (!l) return undefined;
  if (typeof l.value === 'number') return l.value;
  const n = parseFloat(String(l.value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function labPositive(l: LabEvent | undefined): boolean {
  if (!l) return false;
  const v = String(l.value).toLowerCase();
  return v === 'positive' || v === 'reactive' || v === 'pos' || v === '+';
}

export function latestEpds(f: Facts): ScreeningEvent | undefined {
  return [...ofKind(f, 'screening')].reverse().find((s) => s.instrument === 'epds');
}

export function latestFeeding(f: Facts, childId?: string): FeedingEvent | undefined {
  return [...ofKind(f, 'feeding')].reverse().find((e) => !childId || !e.childId || e.childId === childId);
}

export function growthFor(f: Facts, child: Child): GrowthEvent[] {
  const onlyChild = f.children.length === 1;
  return ofKind(f, 'growth').filter((g) => g.childId === child.id || (!g.childId && onlyChild));
}

export function vaccinesGiven(f: Facts, child: Child): string[] {
  const onlyChild = f.children.length === 1;
  const out: string[] = [];
  for (const e of ofKind(f, 'immunisation') as ImmunisationEvent[]) {
    if (e.childId === child.id || (!e.childId && onlyChild && !e.vaccines.some(isMaternalVaccine))) out.push(...e.vaccines);
  }
  return out;
}

export function maternalVaccines(f: Facts): ImmunisationEvent[] {
  return ofKind(f, 'immunisation').filter((e) => !e.childId && e.vaccines.some(isMaternalVaccine));
}

function isMaternalVaccine(v: string): boolean {
  return /^(tt|td)\d*/i.test(v.trim());
}

/** Symptoms reported in the last `days` days, split by subject. */
export function recentSymptoms(f: Facts, days = 7): { mother: SymptomCode[]; baby: SymptomCode[]; events: SymptomEvent[] } {
  const evs = ofKind(f, 'symptom').filter((s) => isRecent(f, s, days));
  const all = new Set<SymptomCode>();
  for (const e of evs) for (const s of e.symptoms) all.add(s);
  const list = [...all];
  return { mother: list.filter((s) => !s.startsWith('baby_')), baby: list.filter((s) => s.startsWith('baby_')), events: evs };
}

export function symptomSeverity(f: Facts, code: SymptomCode, days = 7): SymptomEvent['severity'] | undefined {
  const order = { mild: 1, moderate: 2, severe: 3 } as const;
  let best: SymptomEvent['severity'];
  for (const e of ofKind(f, 'symptom')) {
    if (!isRecent(f, e, days) || !e.symptoms.includes(code) || !e.severity) continue;
    if (!best || order[e.severity] > order[best]) best = e.severity;
  }
  return best;
}

export function ancVisits(f: Facts): VisitEvent[] {
  return ofKind(f, 'visit').filter((v) => v.visitType === 'anc' && v.attended && (!f.lmp || dayMs(v.at) >= dayMs(f.lmp)));
}

/** Medication events (and record entries) that match a name pattern, during an optional window. */
export function medsMatching(f: Facts, re: RegExp, sinceIso?: string): MedicationEvent[] {
  return ofKind(f, 'medication').filter((m) => m.action === 'start' && re.test(m.medication.name) && (!sinceIso || dayMs(m.at) >= dayMs(sinceIso)));
}

export function onMedication(f: Facts, re: RegExp): boolean {
  const fromRecord = f.mother.medications.some((m) => re.test(m.name) && !m.stoppedAt);
  const evs = ofKind(f, 'medication').filter((m) => re.test(m.medication.name));
  const last = evs[evs.length - 1];
  return last ? last.action === 'start' : fromRecord;
}

export function hasCondition(f: Facts, ...codes: Mother['conditions']): boolean {
  return codes.some((c) => f.mother.conditions.includes(c));
}
