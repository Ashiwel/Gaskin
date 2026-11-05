/**
 * Building blocks for the synthetic seed: a seeded PRNG, an event builder
 * that stamps realistic times, and generators for ANC, birth/PNC and infant
 * follow-up histories. Everything is deterministic: same input, same output.
 */
import type {
  Birth,
  Child,
  ClinicalEvent,
  CountryCode,
  Genotype,
  LabTest,
  Medication,
  VisitEvent,
  VitalsEvent,
} from '../types';
import { IMMUNISATION_SCHEDULES } from '../clinical/immunisation';
import { DEMO_START_CLOCK } from './countries';

export const DAY_MS = 86_400_000;
export const CLOCK_MS = Date.parse(DEMO_START_CLOCK);

export type Rng = () => number;

/** mulberry32: small, fast, deterministic. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFor(key: string): Rng {
  return mulberry32(hashString(key));
}

/** Integer in [lo, hi] inclusive. */
export function int(r: Rng, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ISO date (YYYY-MM-DD) for N days before the demo clock. */
export function dateAgo(days: number): string {
  return new Date(CLOCK_MS - days * DAY_MS).toISOString().slice(0, 10);
}

type NewEvent = ClinicalEvent extends infer E ? (E extends ClinicalEvent ? Omit<E, 'id' | 'at' | 'recordedBy'> & { recordedBy?: string } : never) : never;

/**
 * Collects a mother's events. Times: each day gets one clinic-hours start time
 * (08:00–14:59 UTC); later events that day follow a few minutes apart, so a
 * visit, its vitals and labs read in order. Events "today" stay before the clock.
 */
export class EventBuilder {
  private list: ClinicalEvent[] = [];
  private dayCursor = new Map<number, number>();
  readonly motherId: string;
  readonly workerId: string;
  readonly facilityId: string;
  readonly r: Rng;
  constructor(motherId: string, workerId: string, facilityId: string, r: Rng) {
    this.motherId = motherId;
    this.workerId = workerId;
    this.facilityId = facilityId;
    this.r = r;
  }

  /** Timestamp `daysAgo` days before the clock; optional fixed hour:minute (UTC). */
  time(daysAgo: number, hour?: number, minute = 0): string {
    const dayStart = Math.floor((CLOCK_MS - daysAgo * DAY_MS) / DAY_MS) * DAY_MS;
    if (hour !== undefined) return new Date(dayStart + hour * 3_600_000 + minute * 60_000).toISOString();
    let cur = this.dayCursor.get(daysAgo);
    if (cur === undefined) {
      const latest = daysAgo === 0 ? 7 : 14;
      cur = dayStart + int(this.r, 8, latest) * 3_600_000 + int(this.r, 0, 50) * 60_000;
    } else {
      cur += int(this.r, 3, 9) * 60_000;
    }
    if (cur >= CLOCK_MS) cur = CLOCK_MS - 60_000;
    this.dayCursor.set(daysAgo, cur);
    return new Date(cur).toISOString();
  }

  add(daysAgo: number, e: NewEvent, at?: string): void {
    const ev = { ...e, id: '', at: at ?? this.time(daysAgo), recordedBy: e.recordedBy ?? this.workerId } as ClinicalEvent;
    this.list.push(ev);
  }

  visit(daysAgo: number, visitType: VisitEvent['visitType'], extra: Partial<Omit<VisitEvent, 'kind' | 'id' | 'at'>> = {}): void {
    this.add(daysAgo, { kind: 'visit', visitType, attended: true, facilityId: this.facilityId, ...extra });
  }

  vitals(daysAgo: number, v: Partial<Omit<VitalsEvent, 'kind' | 'id' | 'at'>>): void {
    this.add(daysAgo, { kind: 'vitals', ...v });
  }

  lab(daysAgo: number, test: LabTest, value: number | string, unit?: string, note?: string): void {
    this.add(daysAgo, { kind: 'lab', test, value, unit, note });
  }

  med(daysAgo: number, action: 'start' | 'stop', medication: Omit<Medication, 'startedAt'> & { startedAt?: string }, childId?: string, note?: string): void {
    this.add(daysAgo, { kind: 'medication', action, medication: { startedAt: dateAgo(daysAgo), prescribedBy: this.workerId, ...medication }, childId, note });
  }

  /** Sorted by time, ids assigned in order. */
  build(): ClinicalEvent[] {
    const sorted = this.list.slice().sort((a, b) => a.at.localeCompare(b.at));
    return sorted.map((e, i) => ({ ...e, id: `${this.motherId}-e${String(i + 1).padStart(3, '0')}` }));
  }
}

// ---------------------------------------------------------------------------
// Antenatal history (WHO 8-contact model)
// ---------------------------------------------------------------------------

export const ANC_CONTACT_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];

export interface AncOptions {
  /** Days from LMP to the clock */
  lmpDaysAgo: number;
  /** Gestational week of booking */
  bookingWeek: number;
  /** Stop before this gestational week (for past pregnancies: GA at birth) */
  untilWeek?: number;
  country: CountryCode;
  /** IPTp-SP given at contacts from 13 weeks */
  iptp: boolean;
  prePregnancyWeightKg: number;
  bp: { s: number; d: number; risePerWeek?: number };
  /** Hb at booking, then at the 26–28 week check, then optional at 36 */
  hb: number[];
  genotype: Genotype;
  bloodGroup: string;
  hiv?: 'negative' | 'known_positive';
  fetuses?: number;
  /** Visits at or after this week were missed (attended: false) */
  missedFromWeek?: number;
  /** Iron: 'iron_folate' (default) or 'scd' (folic acid 5 mg, no routine iron) */
  ironRegime?: 'iron_folate' | 'scd';
  /** EPDS score recorded once in the third trimester (if reached) */
  epds?: number;
  weightGainFactor?: number;
  ultrasoundText?: string;
}

export function ancHistory(b: EventBuilder, o: AncOptions): void {
  const r = b.r;
  const weeks = [o.bookingWeek, ...ANC_CONTACT_WEEKS.filter((w) => w > o.bookingWeek + 1)];
  let attended = 0;
  let lastIptpDay: number | undefined;
  let iptpDoses = 0;
  let didHbRepeat = false;
  let didEpds = false;
  let didDeworm = false;
  for (const w of weeks) {
    if (o.untilWeek !== undefined && w >= o.untilWeek) break;
    const d = o.lmpDaysAgo - w * 7 - int(r, 0, 3);
    if (d < 1) break;
    const missed = o.missedFromWeek !== undefined && w >= o.missedFromWeek;
    const booking = attended === 0 && !missed;
    if (missed) {
      b.visit(d, 'anc', { contactNumber: attended + 1, attended: false, note: `Did not attend ANC contact ${attended + 1} (${w} weeks).` });
      continue;
    }
    attended++;
    b.visit(d, 'anc', { contactNumber: attended, note: booking ? 'Booking visit. History taken, LLIN issued, danger signs explained.' : undefined });

    const after20 = Math.max(0, w - 20);
    const gain = (w < 13 ? 0.4 : 0.4 + (w - 13) * 0.42) * (o.fetuses === 2 ? 1.3 : 1) * (o.weightGainFactor ?? 1);
    b.vitals(d, {
      systolic: Math.round(o.bp.s + (o.bp.risePerWeek ?? 0) * after20 + (r() * 8 - 4)),
      diastolic: Math.round(o.bp.d + (o.bp.risePerWeek ?? 0) * 0.7 * after20 + (r() * 6 - 3)),
      weightKg: round1(o.prePregnancyWeightKg + gain + (r() * 0.8 - 0.4)),
      temperatureC: round1(36.4 + r() * 0.6),
      pulse: int(r, 76, 94),
      fundalHeightCm: w >= 20 ? w + (o.fetuses === 2 ? 3 : 0) + int(r, -1, 1) : undefined,
      fetalHeartRate: w >= 20 ? int(r, 132, 152) : undefined,
      muacCm: booking ? round1(23 + r() * 5) : undefined,
    });
    b.lab(d, 'urine_protein', 0, '', 'Dipstick: nil');

    if (booking) {
      b.lab(d, 'haemoglobin', o.hb[0], 'g/dL');
      b.lab(d, 'hiv', o.hiv === 'known_positive' ? 'positive' : 'negative', undefined, o.hiv === 'known_positive' ? 'Known positive, on ART' : 'Rapid test, opt-out counselling');
      b.lab(d, 'syphilis', 'negative', undefined, 'RPR non-reactive');
      b.lab(d, 'hepatitis_b', 'negative', undefined, 'HBsAg');
      b.lab(d, 'malaria_rdt', 'negative');
      b.lab(d, 'urine_glucose', 'negative');
      if (o.genotype !== 'unknown') b.lab(d, 'genotype', o.genotype);
      b.lab(d, 'blood_group', o.bloodGroup);
      if (o.ironRegime === 'scd') {
        b.med(d, 'start', { name: 'Folic acid', dose: '5 mg', frequency: 'daily' });
      } else {
        b.med(d, 'start', { name: 'Ferrous sulphate + folic acid (iron-folate)', dose: '60 mg iron + 400 µg folic acid', frequency: 'daily' });
      }
      b.add(d, { kind: 'immunisation', vaccines: ['Td1'], note: 'Tetanus-diphtheria, first dose' });
    }
    if (attended === 2) b.add(d, { kind: 'immunisation', vaccines: ['Td2'] });
    if (w >= 14 && !didDeworm && w <= 30) {
      didDeworm = true;
      b.med(d, 'start', { name: 'Albendazole', dose: '400 mg', frequency: 'single dose' });
    }
    if (o.ultrasoundText && w <= 24 && (booking || w === 20)) {
      b.lab(d, 'ultrasound', o.ultrasoundText);
      o = { ...o, ultrasoundText: undefined };
    }
    if (o.iptp && w >= 13 && (lastIptpDay === undefined || lastIptpDay - d >= 28)) {
      iptpDoses++;
      lastIptpDay = d;
      b.med(d, 'start', { name: 'Sulfadoxine-pyrimethamine (IPTp-SP)', dose: '3 tablets (1500/75 mg) DOT', frequency: 'single dose' }, undefined, `IPTp dose ${iptpDoses}`);
    }
    if (!didHbRepeat && !booking && w >= 26 && o.hb.length > 1) {
      didHbRepeat = true;
      b.lab(d, 'haemoglobin', o.hb[1], 'g/dL');
    } else if (didHbRepeat && w >= 36 && o.hb.length > 2) {
      b.lab(d, 'haemoglobin', o.hb[2], 'g/dL');
      o = { ...o, hb: o.hb.slice(0, 2) };
    }
    if (!didEpds && o.epds !== undefined && w >= 26) {
      didEpds = true;
      b.add(d, { kind: 'screening', instrument: 'epds', score: o.epds });
    }
  }
}

// ---------------------------------------------------------------------------
// Infant growth (approximates WHO medians; enough for plausible charts)
// ---------------------------------------------------------------------------

export function expectedWeight(ageDays: number, birthWeightKg: number, sex: 'F' | 'M', factor = 1): number {
  const g = sex === 'M' ? 1.06 : 1;
  let w = birthWeightKg;
  if (ageDays <= 5) return round2(birthWeightKg * (1 - 0.012 * ageDays));
  if (ageDays <= 12) return round2(birthWeightKg * 0.94 + (birthWeightKg * 0.06 * (ageDays - 5)) / 7);
  const seg = (from: number, to: number, perDay: number) => {
    if (ageDays > from) w += (Math.min(ageDays, to) - from) * perDay * g * factor;
  };
  seg(12, 90, 0.03);
  seg(90, 180, 0.018);
  seg(180, 365, 0.011);
  seg(365, 1000, 0.0065);
  return round2(w);
}

export function expectedLength(ageDays: number, sex: 'F' | 'M'): number {
  let l = sex === 'M' ? 50 : 49.2;
  const seg = (from: number, to: number, perDay: number) => {
    if (ageDays > from) l += (Math.min(ageDays, to) - from) * perDay;
  };
  seg(0, 90, 0.125);
  seg(90, 180, 0.066);
  seg(180, 365, 0.043);
  seg(365, 1000, 0.033);
  return round1(l);
}

export function expectedHead(ageDays: number, sex: 'F' | 'M'): number {
  let h = sex === 'M' ? 34.5 : 33.9;
  const seg = (from: number, to: number, perDay: number) => {
    if (ageDays > from) h += (Math.min(ageDays, to) - from) * perDay;
  };
  seg(0, 90, 0.062);
  seg(90, 180, 0.033);
  seg(180, 365, 0.016);
  seg(365, 1000, 0.0055);
  return round1(h);
}

// ---------------------------------------------------------------------------
// Birth, postnatal care and child follow-up
// ---------------------------------------------------------------------------

export interface BirthOptions {
  birthDaysAgo: number;
  birth: Omit<Birth, 'date'>;
  child: Omit<Child, 'dob' | 'feeding'> & { feeding?: Child['feeding'] };
  country: CountryCode;
  /** PNC contacts to record (days after birth); defaults to the WHO four that are in the past */
  pncDays?: number[];
  /** Maternal BP at PNC */
  bp: { s: number; d: number };
  /** Feeding status at each PNC / child visit (by age) */
  feedingAt?: (ageDays: number) => { status: Child['feeding']; milkSupply?: 'good' | 'low' | 'very_low'; latchProblem?: boolean; feedsPerDay?: number } | undefined;
  /** Vaccines (codes) to leave out, for defaulters */
  skipVaccines?: string[];
  /** Extra delay (days) before each EPI visit */
  epiDelay?: number;
  /** Weight-gain factor for the child (1 = median, <1 slower) */
  growthFactor?: number;
  /** Override weights by age (days) for faltering stories */
  weightOverride?: (ageDays: number, expected: number) => number;
  /** EPDS at the day 7–14 contact */
  epds?: number;
  /** Birth vaccines given late (home birth): day of first facility contact */
  birthVaccinesDay?: number;
}

export function birthAndFollowUp(b: EventBuilder, o: BirthOptions): { birth: Birth; child: Child } {
  const r = b.r;
  const birthDate = dateAgo(o.birthDaysAgo);
  const birth: Birth = { ...o.birth, date: birthDate };
  const child: Child = { feeding: 'exclusive_breastfeeding', ...o.child, dob: birthDate };
  const cid = child.id;
  const atFacility = birth.place === 'facility';

  b.add(o.birthDaysAgo, {
    kind: 'birth',
    birth,
    child,
    recordedBy: b.workerId,
    note: atFacility ? undefined : `Birth ${birth.place === 'tba' ? 'with a traditional birth attendant' : birth.place === 'in_transit' ? 'on the way to the facility' : 'at home'}; recorded at first contact.`,
  }, b.time(o.birthDaysAgo, int(r, 1, 6), int(r, 0, 59)));

  if (atFacility) {
    const vacc = o.country === 'KE' ? ['BCG', 'OPV0'] : ['BCG', 'OPV0', 'HepB0'];
    b.med(o.birthDaysAgo, 'start', { name: 'Vitamin K (phytomenadione)', dose: child.birthWeightKg < 1.5 ? '0.5 mg IM' : '1 mg IM', frequency: 'once' }, cid);
    if (o.country === 'NG') b.med(o.birthDaysAgo, 'start', { name: 'Chlorhexidine 7.1% gel (cord)', dose: 'apply to stump', frequency: 'daily for 7 days' }, cid);
    b.add(Math.max(1, o.birthDaysAgo - 1), { kind: 'immunisation', vaccines: vacc, childId: cid });
  } else if (o.birthVaccinesDay !== undefined && o.birthDaysAgo - o.birthVaccinesDay >= 1) {
    const vacc = o.country === 'KE' ? ['BCG', 'OPV0'] : ['BCG', 'OPV0', 'HepB0'];
    b.add(o.birthDaysAgo - o.birthVaccinesDay, { kind: 'immunisation', vaccines: o.birthDaysAgo - o.birthVaccinesDay > 14 ? vacc.filter((v) => v !== 'HepB0') : vacc, childId: cid, note: 'Birth doses given late (home birth).' });
  }

  const weightAt = (age: number) => {
    const e = expectedWeight(age, child.birthWeightKg, child.sex, o.growthFactor);
    return o.weightOverride ? round2(o.weightOverride(age, e)) : e;
  };
  const feed = (age: number, d: number) => {
    const f = o.feedingAt?.(age) ?? (age < 183 ? { status: 'exclusive_breastfeeding' as const, milkSupply: 'good' as const } : { status: 'complementary_with_breastmilk' as const });
    b.add(d, { kind: 'feeding', status: f.status, milkSupply: f.milkSupply, latchProblem: f.latchProblem, feedsPerDay: f.feedsPerDay ?? (age < 90 ? int(r, 8, 12) : undefined), childId: cid });
  };

  // ---- Postnatal contacts (WHO 2022 rec. 44) ----
  const pncDays = o.pncDays ?? [1, 3, 10, 42];
  for (const day of pncDays) {
    const d = o.birthDaysAgo - day;
    if (d < 1) continue;
    const home = !atFacility || (day >= 3 && day <= 14 && r() < 0.5);
    b.visit(d, home ? 'home_visit' : 'pnc', { note: `Postnatal check, day ${day}.` });
    b.vitals(d, {
      systolic: Math.round(o.bp.s + (r() * 8 - 4)),
      diastolic: Math.round(o.bp.d + (r() * 6 - 3)),
      temperatureC: round1(36.5 + r() * 0.5),
      pulse: int(r, 74, 92),
    });
    b.vitals(d, { childId: cid, temperatureC: round1(36.6 + r() * 0.5) });
    b.add(d, { kind: 'growth', childId: cid, weightKg: weightAt(day), lengthCm: day >= 7 ? expectedLength(day, child.sex) : undefined, headCircumferenceCm: day >= 7 ? expectedHead(day, child.sex) : undefined });
    feed(day, d);
    if (day >= 7 && day <= 14 && o.epds !== undefined) b.add(d, { kind: 'screening', instrument: 'epds', score: o.epds });
    if (day >= 42) b.add(d, { kind: 'screening', instrument: 'epds', score: int(r, 2, 7) });
  }

  // ---- EPI visits with growth monitoring ----
  const ageNow = o.birthDaysAgo;
  for (const v of IMMUNISATION_SCHEDULES[o.country]) {
    if (v.ageDays === 0) continue;
    const age = v.ageDays + (o.epiDelay ?? 0) + int(r, 0, 5);
    const d = ageNow - age;
    if (d < 1) continue;
    const vaccines = v.vaccines.filter((x) => !(o.skipVaccines ?? []).some((s) => x.startsWith(s)));
    b.visit(d, 'child_health', { note: `Immunisation visit (${v.label}).` });
    if (vaccines.length) b.add(d, { kind: 'immunisation', vaccines, childId: cid });
    b.add(d, {
      kind: 'growth',
      childId: cid,
      weightKg: weightAt(age),
      lengthCm: expectedLength(age, child.sex),
      headCircumferenceCm: age <= 730 ? expectedHead(age, child.sex) : undefined,
      muacCm: age >= 182 ? round1(13.4 + r() * 1.4 + (age - 182) / 900) : undefined,
    });
    feed(age, d);
  }
  return { birth, child };
}
