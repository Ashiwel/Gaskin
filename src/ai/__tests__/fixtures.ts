import type { CarePlan, Mother, PlanItem, Alert } from '../../types';

export const ASOF = '2026-11-05T09:00:00Z';

export function item(p: Partial<PlanItem> & Pick<PlanItem, 'id' | 'title' | 'motherText'>): PlanItem {
  return {
    category: 'education',
    detail: p.title,
    priority: 3,
    audience: 'both',
    evidence: 'A',
    sources: [],
    because: [],
    origin: 'guideline',
    status: 'active',
    ...p,
  };
}

export function mother(over: Partial<Mother> = {}): Mother {
  return {
    id: 'm-ng-001',
    name: 'Adaeze Okafor',
    age: 24,
    country: 'NG',
    region: 'Enugu',
    community: 'Nsukka Ward 4',
    language: 'en',
    literacy: 'basic',
    phone: { access: 'feature', number: '+234 803 555 0142', hasWhatsApp: false },
    email: 'adaeze.okafor@example.com',
    incomeBand: 'low',
    householdNotes: 'Lives with husband Chinedu and mother-in-law Mama Ngozi at 14 Ugwu Street, Nsukka. Call 0803 555 0142.',
    gravida: 2,
    parity: 1,
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: true,
    conditions: ['anaemia'],
    allergies: [],
    genotype: 'AS',
    medications: [{ name: 'ferrous sulphate', dose: '200 mg', frequency: 'daily', startedAt: '2026-09-01', prescribedBy: 'Dr Emeka Nwosu' }],
    pregnancy: { lmp: '2026-04-10', fetuses: 1 },
    children: [],
    practicesMentioned: [],
    assignedWorkerId: 'w-ng-01',
    facilityId: 'f-ng-01',
    enrolledAt: '2026-06-01',
    consent: { dataProcessing: true, messaging: true, recordedAt: '2026-06-01', recordedBy: 'w-ng-01' },
    events: [
      { id: 'e1', kind: 'report', at: '2026-10-20T10:00:00Z', recordedBy: 'w-ng-01', author: 'Dr Emeka Nwosu', text: 'Mrs Adaeze Okafor seen at UNTH Enugu on 20/10/2026. PCV 27%.' },
    ],
    ...over,
  } as Mother;
}

export function plan(m: Mother, over: Partial<CarePlan> = {}, alerts: Alert[] = []): CarePlan {
  return {
    motherId: m.id,
    version: 1,
    generatedAt: ASOF,
    state: {
      motherId: m.id,
      asOf: ASOF,
      stage: 'pregnancy',
      trimester: 3,
      gestationalWeeks: 29,
      edd: '2027-01-15',
      latest: { haemoglobin: 9 },
      recentSymptoms: [],
      ancContactsAttended: 3,
      risks: [{ code: 'anaemia', label: 'Moderate anaemia', severity: 'moderate', reason: 'Hb 9.0 g/dL on 2026-10-20 at Nsukka PHC', sources: [] }],
    },
    summary: `${m.name.split(' ')[0]} is 29 weeks pregnant with moderate anaemia.`,
    alerts,
    items: [
      item({ id: 'med.iron_folate', category: 'medication', title: 'Iron and folic acid', motherText: 'Take one ferrous sulphate 200 mg tablet and folic acid 400 mcg every day with water or orange juice.', priority: 1, locked: true, because: ['Hb 9.0 g/dL (moderate anaemia)'], illustration: 'iron_tablet' }),
      item({ id: 'visit.anc', category: 'visits', title: 'Next ANC contact', motherText: 'Come to the clinic for your next check-up at 30 weeks.', priority: 2, because: ['WHO 8-contact schedule'], dueDate: '2026-11-12' }),
      item({ id: 'nutrition.iron_foods', category: 'nutrition', title: 'Iron-rich foods', motherText: 'Eat beans, ugu leaves, liver and fish when you can.', priority: 3, because: ['Anaemia'] }),
      item({ id: 'rest.left_side', category: 'rest_and_sleep', title: 'Sleep on your side', motherText: 'Sleep on your left side from now until birth.', priority: 4, because: ['Third trimester'] }),
    ],
    nextContact: { date: '2026-11-12', type: 'anc', label: 'ANC contact 5 (30 weeks)' },
    ...over,
  };
}

export const EMERGENCY_ALERT: Alert = {
  id: 'alert.severe_pe',
  level: 'emergency',
  title: 'Signs of severe pre-eclampsia',
  action: 'Refer to hospital now',
  reason: 'BP 165/112 with headache',
  sources: [],
  subject: 'mother',
};

/** A few varied mothers for the privacy sweep when the seed is not available */
export function fixtureMothers(): Mother[] {
  return [
    mother(),
    mother({
      id: 'm-ke-007',
      name: 'Wanjiru Kamau',
      age: 16,
      country: 'KE',
      region: 'Kiambu',
      community: 'Githurai 45',
      language: 'sw',
      phone: { access: 'smartphone', number: '0712 345 678', hasWhatsApp: true },
      email: undefined,
      householdNotes: 'Her aunt Njeri Mwangi brings her. Phone +254 722 111 222.',
      children: [{ id: 'c-ke-1', name: 'Baraka', sex: 'M', dob: '2026-10-01', birthWeightKg: 2.9, gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding' }],
      pregnancy: undefined,
      birth: { date: '2026-10-01', mode: 'vaginal', place: 'facility', complications: ['none'] },
      assignedWorkerId: 'w-ke-01',
      facilityId: 'f-ke-01',
      events: [{ id: 'e2', kind: 'report', at: '2026-10-02T08:00:00Z', recordedBy: 'w-ke-01', author: 'Dr Otieno', text: 'Discharged from Thika Level 5 Hospital on 2nd October 2026. Baby Baraka well. Mother Hb 10.2 g/dL.' }],
    }),
    mother({
      id: 'm-gh-003',
      name: 'Akosua Mensah',
      age: 33,
      country: 'GH',
      region: 'Ashanti',
      community: 'Ejisu',
      language: 'tw',
      phone: { access: 'shared', number: '024 412 3456', hasWhatsApp: false },
      email: undefined,
      householdNotes: 'Shares phone with husband Kwame Mensah.',
      assignedWorkerId: 'w-gh-01',
      facilityId: 'f-gh-01',
      events: [],
    }),
    mother({
      id: 'm-ng-009',
      name: 'Joy Abubakar',
      age: 19,
      region: 'Kano',
      community: 'Dala',
      language: 'ha',
      phone: { access: 'feature', number: '08031234567', hasWhatsApp: false },
      email: undefined,
      householdNotes: 'Husband Musa Abubakar works in Kano market.',
      events: [],
    }),
  ];
}

export const DIRECTORY = {
  workers: [
    { id: 'w-ng-01', name: 'Nurse Fatima Bello' },
    { id: 'w-ke-01', name: 'Grace Achieng' },
    { id: 'w-gh-01', name: 'Abena Owusu' },
  ],
  facilities: [
    { id: 'f-ng-01', name: 'Nsukka Primary Health Centre', region: 'Enugu' },
    { id: 'f-ke-01', name: 'Githurai Dispensary', region: 'Kiambu' },
    { id: 'f-gh-01', name: 'Ejisu CHPS Compound', region: 'Ashanti' },
  ],
};
