import type {
  BirthEvent,
  Child,
  ClinicalEvent,
  DemoState,
  InboundMessage,
  Mother,
  PatientState,
} from '../types';
import { buildPlan, deriveState } from '../engine';
import { parseSymptomsFromText } from '../messaging';
import { FACILITIES, WORKERS } from '../data/directory';

export type Scenario = {
  id: string;
  title: string;
  description: string;
  appliesTo: (m: Mother, s: PatientState) => boolean;
  apply: (state: DemoState, motherId: string) => DemoState;
};

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Helpers: immutable updates, event ids and times at the current clock
// ---------------------------------------------------------------------------

type NewEvent = ClinicalEvent extends infer E ? (E extends ClinicalEvent ? Omit<E, 'id' | 'at' | 'recordedBy'> & { recordedBy?: string } : never) : never;

function findMother(state: DemoState, motherId: string): Mother {
  const m = state.mothers.find((x) => x.id === motherId);
  if (!m) throw new Error(`Unknown mother: ${motherId}`);
  return m;
}

/** Worker recording the event: the current worker (the demo user) by default. */
function recorder(state: DemoState, m: Mother): string {
  return state.currentWorkerId || m.assignedWorkerId;
}

/** A new event id unique within the mother's timeline. */
function nextId(m: Mother, tag: string, offset: number): string {
  return `${m.id}-${tag}-${m.events.length + offset + 1}`;
}

/**
 * Append events at the clock (a minute apart, so order is stable and every
 * event is at or before `clock + n minutes`; the first sits exactly at the clock).
 */
function withEvents(state: DemoState, motherId: string, tag: string, events: NewEvent[], patch?: (m: Mother) => Partial<Mother>, extra?: Partial<DemoState>): DemoState {
  const m = findMother(state, motherId);
  const base = Date.parse(state.clock);
  const added: ClinicalEvent[] = events.map(
    (e, i) =>
      ({
        ...e,
        id: nextId(m, tag, i),
        at: new Date(base - (events.length - 1 - i) * 60_000).toISOString(),
        recordedBy: e.recordedBy ?? recorder(state, m),
      }) as ClinicalEvent,
  );
  const updated: Mother = { ...m, ...(patch ? patch(m) : {}), events: [...m.events, ...added] };
  return { ...state, ...extra, mothers: state.mothers.map((x) => (x.id === motherId ? updated : x)) };
}

function youngest(m: Mother, s?: PatientState): Child | undefined {
  if (s?.infant) return s.infant;
  return [...m.children].sort((a, b) => a.dob.localeCompare(b.dob)).pop();
}

function stateOf(state: DemoState, motherId: string): PatientState {
  return deriveState(findMother(state, motherId), state.clock);
}

function facilityName(id: string | undefined): string {
  return FACILITIES.find((f) => f.id === id)?.name ?? 'the referral hospital';
}

function referralFacility(m: Mother): string | undefined {
  return FACILITIES.find((f) => f.id === m.facilityId)?.referralFacilityId;
}

const pregnantOrPostpartum = (_m: Mother, s: PatientState) => s.stage === 'pregnancy' || s.stage === 'postpartum';
const hasBaby = (_m: Mother, s: PatientState) => (s.stage === 'postpartum' || s.stage === 'infant') && !!s.infant;

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const SCENARIOS: Scenario[] = [
  {
    id: 'bp_rise',
    title: 'Blood pressure rises',
    description: 'BP 152/100 with a severe headache and urine protein ++ at today’s check. Expect an emergency pre-eclampsia alert and referral.',
    appliesTo: pregnantOrPostpartum,
    apply: (state, id) => {
      const s = stateOf(state, id);
      return withEvents(state, id, 'bp', [
        { kind: 'visit', visitType: s.stage === 'pregnancy' ? 'anc' : 'pnc', attended: true, facilityId: findMother(state, id).facilityId, note: 'Unscheduled visit: came in with headache.' },
        { kind: 'vitals', systolic: 152, diastolic: 100, pulse: 96, temperatureC: 36.8, weightKg: s.latest.weightKg !== undefined ? Math.round((s.latest.weightKg + 1.4) * 10) / 10 : undefined },
        { kind: 'lab', test: 'urine_protein', value: 2, note: 'Dipstick ++' },
        { kind: 'symptom', symptoms: ['severe_headache', 'swelling_face_hands'], severity: 'severe', via: 'visit', note: 'Frontal headache since last night, not relieved by paracetamol. Face looks puffy.' },
      ]);
    },
  },
  {
    id: 'anaemia_lab',
    title: 'Low blood (Hb 7.8)',
    description: 'Haemoglobin comes back at 7.8 g/dL. Expect moderate-anaemia alert, treatment-dose iron and a repeat test.',
    appliesTo: () => true,
    apply: (state, id) => withEvents(state, id, 'hb', [{ kind: 'lab', test: 'haemoglobin', value: 7.8, unit: 'g/dL', note: 'Point-of-care haemoglobinometer (HemoCue).' }]),
  },
  {
    id: 'epds_high',
    title: 'Low mood (EPDS 16)',
    description: 'Edinburgh screen scores 16 (probable depression), no self-harm. Expect a mental-health alert and Thinking Healthy support.',
    appliesTo: (_m, s) => s.stage !== 'preconception',
    apply: (state, id) =>
      withEvents(state, id, 'epds', [
        { kind: 'screening', instrument: 'epds', score: 16, selfHarmFlag: false, note: 'Item 10 (self-harm): "Never".' },
        { kind: 'symptom', symptoms: ['low_mood', 'insomnia', 'anxiety'], severity: 'moderate', via: 'visit' },
      ]),
  },
  {
    id: 'epds_selfharm',
    title: 'Thoughts of self-harm (EPDS 18)',
    description: 'EPDS 18 with item 10 answered positively. Expect an emergency alert: do not leave her alone, same-day mental-health referral.',
    appliesTo: (_m, s) => s.stage !== 'preconception',
    apply: (state, id) =>
      withEvents(state, id, 'epds', [
        { kind: 'screening', instrument: 'epds', score: 18, selfHarmFlag: true, note: 'Item 10: "Sometimes" (thoughts of harming herself).' },
        { kind: 'symptom', symptoms: ['low_mood', 'thoughts_of_self_harm'], severity: 'severe', via: 'visit' },
      ]),
  },
  {
    id: 'low_milk',
    title: 'Low milk supply',
    description: 'Feeding check: low supply, latch problem, only 5 feeds a day. Expect breastfeeding support items to move up.',
    appliesTo: (_m, s) => hasBaby(_m, s) && (s.infantAgeDays ?? 999) < 365 && s.latest.milkSupply !== 'low' && s.latest.milkSupply !== 'very_low',
    apply: (state, id) => {
      const m = findMother(state, id);
      const s = stateOf(state, id);
      const child = youngest(m, s);
      return withEvents(state, id, 'milk', [
        { kind: 'feeding', status: 'mixed', milkSupply: 'low', latchProblem: true, feedsPerDay: 5, childId: child?.id, note: 'Baby fusses at the breast; grandmother giving water and pap between feeds.' },
        { kind: 'symptom', symptoms: ['low_milk_supply', 'cracked_nipples'], severity: 'moderate', via: 'visit' },
      ]);
    },
  },
  {
    id: 'give_birth',
    title: 'She gives birth',
    description: 'Records the birth and the baby. Mode follows her history (planned caesarean for twins, or previous caesarean with breech; otherwise vaginal). Plan switches to postpartum and newborn care.',
    appliesTo: (_m, s) => s.stage === 'pregnancy' && (s.gestationalWeeks ?? 0) >= 24,
    apply: (state, id) => {
      const m = findMother(state, id);
      const s = stateOf(state, id);
      const ga = Math.min(41, s.gestationalWeeks ?? 39);
      const twins = (m.pregnancy?.fetuses ?? 1) >= 2;
      const caesarean = twins || (m.previousCaesarean && m.parity >= 2);
      const preterm = ga < 37;
      const date = state.clock.slice(0, 10);
      const sex: Child['sex'] = m.id.length % 2 === 0 ? 'F' : 'M';
      const surname = m.name.split(' ').slice(-1)[0];
      const firstNames = sex === 'F' ? FIRST_NAMES_F[m.country] : FIRST_NAMES_M[m.country];
      const name = `${firstNames[m.id.length % firstNames.length]} ${surname}`;
      const birthWeightKg = Math.round(((twins ? 2.3 : 3.1) - (preterm ? (39 - ga) * 0.18 : 0)) * 100) / 100;
      const child: Child = {
        id: `c-${m.id.replace(/^m-/, '')}-${m.children.length + 1}`,
        name,
        sex,
        dob: date,
        birthWeightKg,
        gestationAtBirthWeeks: ga,
        feeding: 'exclusive_breastfeeding',
      };
      const birthEv: Omit<BirthEvent, 'id' | 'at' | 'recordedBy'> = {
        kind: 'birth',
        birth: {
          date,
          mode: caesarean ? 'caesarean' : 'vaginal',
          place: 'facility',
          complications: preterm ? ['preterm'] : ['none'],
          bloodLossMl: caesarean ? 650 : 300,
        },
        child,
        note: caesarean ? (twins ? 'Caesarean for twin pregnancy (first twin breech).' : 'Repeat caesarean.') : 'Spontaneous vaginal birth; active management of third stage with oxytocin.',
      };
      const events: NewEvent[] = [birthEv, { kind: 'vitals', systolic: 118, diastolic: 74, pulse: 88, temperatureC: 36.9 }, { kind: 'feeding', status: 'exclusive_breastfeeding', milkSupply: 'good', childId: child.id, note: 'Breastfed within the first hour; skin-to-skin.' }];
      if (twins) {
        const twin: Child = { ...child, id: `${child.id}b`, name: `${firstNames[(m.id.length + 1) % firstNames.length]} ${surname}`, sex: sex === 'F' ? 'M' : 'F', birthWeightKg: Math.round((birthWeightKg - 0.15) * 100) / 100 };
        events.splice(1, 0, { ...birthEv, child: twin, note: 'Second twin.' });
      }
      return withEvents(state, id, 'birth', events, (mm) => ({ birth: birthEv.birth, parity: mm.parity + 1, children: [...mm.children, child] }));
    },
  },
  {
    id: 'newborn_danger',
    title: 'Baby breathing fast with fever',
    description: 'Mother reports the baby is breathing fast and is hot. Expect an emergency newborn alert (possible serious bacterial infection).',
    appliesTo: (_m, s) => hasBaby(_m, s) && (s.infantAgeDays ?? 999) <= 59,
    apply: (state, id) => {
      const m = findMother(state, id);
      const child = youngest(m, stateOf(state, id));
      return withEvents(state, id, 'nb', [
        { kind: 'symptom', symptoms: ['baby_fast_breathing', 'baby_fever'], severity: 'severe', via: 'worker_call', childId: child?.id, note: 'Phone call: baby "breathing fast fast" and hot since morning.' },
        { kind: 'vitals', childId: child?.id, temperatureC: 38.4, pulse: 168 },
      ]);
    },
  },
  {
    id: 'missed_visit',
    title: 'Missed a visit',
    description: 'Time moves to two days after her next scheduled contact, which she did not attend. Expect the contact to show as missed or overdue and her to rise in the follow-up list.',
    appliesTo: () => true,
    apply: (state, id) => {
      const m = findMother(state, id);
      const s = deriveState(m, state.clock);
      const next = buildPlan(m, state.clock, { overrides: state.overrides, learnedRules: state.learnedRules }).nextContact;
      const clockMs = Date.parse(state.clock);
      const dueMs = next ? Date.parse(next.date.length <= 10 ? `${next.date}T09:00:00.000Z` : next.date) : NaN;
      // Next contact in the future: move the clock to 2 days after it. Already due or overdue: a week passes without her.
      const jump = Number.isFinite(dueMs) && dueMs > clockMs && dueMs - clockMs <= 120 * DAY ? Math.ceil((dueMs - clockMs) / DAY) + 2 : 7;
      const moved = jump ? advanceClock(state, jump) : state;
      const type = next?.type ?? (s.stage === 'pregnancy' ? 'anc' : s.stage === 'postpartum' ? 'pnc' : s.stage === 'infant' ? 'child_health' : 'home_visit');
      const missedAt = new Date(Date.parse(moved.clock) - (jump === 7 && !(dueMs > clockMs) ? 0 : 2) * DAY).toISOString();
      const ev: ClinicalEvent = {
        id: nextId(m, 'miss', 0),
        at: missedAt,
        recordedBy: recorder(state, m),
        kind: 'visit',
        visitType: type,
        attended: false,
        facilityId: m.facilityId,
        note: `Did not attend${next ? ` ${next.label}` : ' the scheduled visit'}. Phone not reachable.`,
      };
      return { ...moved, mothers: moved.mothers.map((x) => (x.id === id ? { ...m, events: [...m.events, ev] } : x)) };
    },
  },
  {
    id: 'doctor_report',
    title: 'Doctor’s report arrives',
    description: 'A free-text clinic letter with BP, Hb, diagnosis and medicines is uploaded. Findings are not yet extracted: use AI extraction and confirm.',
    appliesTo: () => true,
    apply: (state, id) => {
      const m = findMother(state, id);
      const s = stateOf(state, id);
      const fac = facilityName(referralFacility(m));
      const doc = DOCTORS[m.country];
      const first = m.name;
      let text: string;
      if (s.stage === 'pregnancy') {
        const ga = s.gestationalWeeks ?? 30;
        text = `${fac.toUpperCase()}: ANTENATAL CLINIC REVIEW. ${first}, ${m.age}, G${m.gravida}P${m.parity}, ${ga} weeks. Referred from PHC with raised BP. Today BP 146/94 mmHg (repeat 144/92), urinalysis protein +, Hb 9.4 g/dL, platelets 210, creatinine 72 µmol/L, ALT 28 U/L. Impression: gestational hypertension, rule out pre-eclampsia; mild anaemia. Plan: start methyldopa 250 mg three times daily; continue ferrous sulphate 200 mg daily and folic acid; low-dose aspirin 75 mg at night to 36 weeks. Twice-weekly BP checks at PHC. Return immediately if headache, blurred vision, epigastric pain or BP ≥160/110. Review here in 1 week.`;
      } else if (s.stage === 'postpartum') {
        text = `${fac.toUpperCase()}: POSTNATAL REVIEW. ${first}, ${m.age}, day ${s.daysPostpartum ?? 7} after birth. BP 138/88 mmHg. Hb 8.6 g/dL. Lochia normal, uterus well involuted. Impression: postpartum anaemia. Plan: ferrous sulphate 200 mg three times daily for 3 months, folic acid 5 mg daily; repeat FBC in 4 weeks; BP check at PHC in 1 week. Breastfeeding well.`;
      } else if (s.stage === 'infant') {
        const c = youngest(m, s);
        text = `${fac.toUpperCase()}: PAEDIATRIC OUTPATIENT NOTE. ${c?.name ?? 'Child'} (${Math.round((s.infantAgeDays ?? 300) / 30.4)} months). Weight ${s.latest.infantWeightKg ?? 7.1} kg, MUAC 12.3 cm. Hb 9.8 g/dL. Impression: moderate acute malnutrition with iron-deficiency anaemia. Plan: enrol in supplementary feeding; ferrous sulphate syrup 2 mg/kg daily for 3 months; deworming albendazole 200 mg single dose; review in 2 weeks. Mother: BP 124/78 mmHg.`;
      } else {
        text = `${fac.toUpperCase()}: GYNAECOLOGY CLINIC. ${first}, ${m.age}. BP 132/86 mmHg. Hb 10.8 g/dL. Impression: borderline blood pressure; mild anaemia. Plan: folic acid 400 µg daily, ferrous sulphate 200 mg daily for 3 months; lifestyle advice; recheck BP in 4 weeks. Fit to plan pregnancy.`;
      }
      return withEvents(state, id, 'rep', [{ kind: 'report', author: `${doc}, ${fac}`, text }]);
    },
  },
  {
    id: 'whatsapp_symptom',
    title: 'WhatsApp: headache and swelling (Pidgin)',
    description: 'She sends a Pidgin WhatsApp message about a pounding headache and swollen feet. The system parses it into symptoms. Expect an urgent BP-check alert.',
    appliesTo: pregnantOrPostpartum,
    apply: (state, id) => {
      const m = findMother(state, id);
      const body = 'Good morning nurse. Since yesterday my head dey bang me well well and my leg don swell, even my face. Abeg wetin I go do?';
      const parsed = parseSymptomsFromText(body);
      const msg: InboundMessage = {
        id: `in-${m.id}-${state.inbound.length + 1}`,
        motherId: id,
        channel: m.phone.hasWhatsApp ? 'whatsapp' : 'sms',
        body,
        receivedAt: state.clock,
        parsedSymptoms: parsed,
      };
      return withEvents(state, id, 'wa', [{ kind: 'symptom', symptoms: parsed, severity: 'severe', via: msg.channel === 'whatsapp' ? 'whatsapp' : 'sms', recordedBy: 'mother', note: `Parsed from ${msg.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}: "${body}"` }], undefined, { inbound: [...state.inbound, msg] });
    },
  },
  {
    id: 'malaria_positive',
    title: 'Malaria test positive',
    description: 'Fever 38.5 °C and a positive malaria RDT. Expect a malaria-in-pregnancy alert and treatment by trimester.',
    appliesTo: () => true,
    apply: (state, id) =>
      withEvents(state, id, 'mal', [
        { kind: 'symptom', symptoms: ['fever', 'fatigue'], severity: 'moderate', via: 'visit', note: 'Fever, chills and body pains for 2 days.' },
        { kind: 'vitals', temperatureC: 38.5, pulse: 106 },
        { kind: 'lab', test: 'malaria_rdt', value: 'positive', note: 'P. falciparum (HRP2) RDT' },
      ]),
  },
  {
    id: 'gdm_ogtt',
    title: 'High sugar on glucose test',
    description: '75 g OGTT: 2-hour glucose 9.1 mmol/L (≥8.5 = gestational diabetes). Expect a GDM risk and diet and monitoring items.',
    appliesTo: (m, s) => s.stage === 'pregnancy' && !m.conditions.includes('gestational_diabetes') && !s.risks.some((r) => r.code === 'gdm'),
    apply: (state, id) =>
      withEvents(state, id, 'gdm', [
        { kind: 'lab', test: 'blood_glucose_fasting', value: 5.0, unit: 'mmol/L' },
        { kind: 'lab', test: 'ogtt_2h', value: 9.1, unit: 'mmol/L', note: '75 g oral glucose tolerance test, 2-hour value' },
      ]),
  },
  {
    id: 'growth_faltering',
    title: 'Baby losing weight',
    description: 'Today’s weight is lower than the last one (no gain over 2+ weeks), MUAC borderline. Expect a poor-growth risk and feeding review.',
    appliesTo: (_m, s) => hasBaby(_m, s),
    apply: (state, id) => {
      const m = findMother(state, id);
      const s = stateOf(state, id);
      const child = youngest(m, s);
      if (!child) return state;
      // Last recorded weight for this child, else an expected one.
      const weights = m.events.filter((e) => e.kind === 'growth' && (e.childId === child.id || !e.childId) && e.weightKg !== undefined);
      const last = weights[weights.length - 1];
      const lastKg = last && last.kind === 'growth' ? last.weightKg! : child.birthWeightKg;
      const age = s.infantAgeDays ?? 0;
      // Make sure the comparison spans ≥14 days: if the last weight is recent, add an earlier one too.
      const recent = last ? (Date.parse(state.clock) - Date.parse(last.at)) / 86_400_000 < 14 : true;
      const events: NewEvent[] = [];
      let baseKg = lastKg;
      if (recent) {
        baseKg = Math.round((lastKg + 0.1) * 100) / 100;
        const earlier: NewEvent = { kind: 'growth', childId: child.id, weightKg: baseKg, note: 'Weight from the child health card (17 days ago).' };
        events.push(earlier);
      }
      const today = Math.round((Math.max(baseKg - (age < 60 ? 0.12 : 0.3), age >= 14 ? child.birthWeightKg - 0.05 : baseKg - 0.1)) * 100) / 100;
      events.push({ kind: 'growth', childId: child.id, weightKg: Math.min(today, baseKg - 0.05), muacCm: age >= 182 ? 11.4 : undefined, note: age >= 182 ? 'Weighed on the Salter scale. MUAC tape: red (11.4 cm).' : 'Weighed on the Salter scale at the clinic.' });
      events.push({ kind: 'feeding', status: age < 183 ? 'mixed' : 'complementary_with_breastmilk', childId: child.id, note: 'Eats little; family meals are mostly pap or porridge.' });
      let next = withEvents(state, id, 'grow', events);
      if (recent) {
        // Back-date the card weight by 17 days.
        const mm = findMother(next, id);
        const idx = mm.events.length - events.length;
        const backdated = { ...mm.events[idx], at: new Date(Date.parse(state.clock) - 17 * 86_400_000).toISOString() };
        const evs = [...mm.events];
        evs[idx] = backdated;
        evs.sort((a, b) => a.at.localeCompare(b.at));
        next = { ...next, mothers: next.mothers.map((x) => (x.id === id ? { ...mm, events: evs } : x)) };
      }
      return next;
    },
  },
];

const DOCTORS: Record<Mother['country'], string> = {
  NG: 'Dr Olufemi Bankole (Consultant O&G)',
  KE: 'Dr Joseph Mutua (Medical Officer)',
  GH: 'Dr Kwesi Ansah (Specialist O&G)',
};

const FIRST_NAMES_F: Record<Mother['country'], string[]> = {
  NG: ['Chiamaka', 'Oluwadamilola', 'Zainab', 'Ebiere', 'Osasere', 'Nkechi', 'Aisha'],
  KE: ['Achieng', 'Wanjiku', 'Zawadi', 'Akinyi', 'Imani'],
  GH: ['Ama', 'Afia', 'Mariama', 'Esi', 'Sedinam'],
};
const FIRST_NAMES_M: Record<Mother['country'], string[]> = {
  NG: ['Chinonso', 'Oluwaseun', 'Ibrahim', 'Tamunosaki', 'Osaro', 'Ifeanyi', 'Musa'],
  KE: ['Otieno', 'Kamau', 'Baraka', 'Juma', 'Omondi'],
  GH: ['Kofi', 'Kwame', 'Abdul-Rahman', 'Yaw', 'Selorm'],
};

/**
 * Move the demo clock forward (or back) by whole days. Events are left as they
 * are: time passes, nothing new happens, so visits fall due and alerts based on
 * "recent" events can expire.
 */
export function advanceClock(state: DemoState, days: number): DemoState {
  const next = new Date(Date.parse(state.clock) + days * 86_400_000).toISOString();
  return { ...state, clock: next };
}

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** Scenarios that make sense for this mother today. */
export function scenariosFor(m: Mother, s: PatientState): Scenario[] {
  return SCENARIOS.filter((sc) => sc.appliesTo(m, s));
}

// Keep the worker directory referenced so recorder ids stay valid in tests.
export const DEMO_WORKER_IDS = WORKERS.map((w) => w.id);
