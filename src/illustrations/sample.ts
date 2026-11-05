/**
 * Fake data for previewing and testing the handout (dev only, not used by the app).
 */
import type { CarePlan, Mother, PlanItem } from '../types';
import type { HandoutInput } from './handout';

function item(p: Partial<PlanItem> & Pick<PlanItem, 'id' | 'category' | 'title' | 'motherText'>): PlanItem {
  return {
    detail: '',
    priority: 2,
    audience: 'both',
    evidence: 'A',
    sources: [],
    because: [],
    origin: 'guideline',
    status: 'active',
    ...p,
  };
}

export function sampleMother(name = 'Amina Bello'): Mother {
  return {
    id: 'm-demo',
    name,
    age: 24,
    country: 'NG',
    region: 'Kano',
    community: 'Dala',
    language: 'en',
    literacy: 'basic',
    phone: { access: 'feature', hasWhatsApp: false },
    incomeBand: 'low',
    gravida: 2,
    parity: 1,
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    conditions: ['anaemia'],
    allergies: [],
    genotype: 'AS',
    medications: [],
    pregnancy: { lmp: '2026-04-02', fetuses: 1, plannedBirthPlace: 'facility' },
    children: [],
    practicesMentioned: [],
    assignedWorkerId: 'w-1',
    facilityId: 'f-1',
    enrolledAt: '2026-06-01',
    consent: { dataProcessing: true, messaging: true, recordedAt: '2026-06-01', recordedBy: 'w-1' },
    events: [],
  };
}

export function samplePlan(): CarePlan {
  const items: PlanItem[] = [
    item({ id: 'danger.bleeding', category: 'danger_signs', title: 'Bleeding is an emergency', motherText: 'Any blood from your private part: go to the clinic at once. Do not wait.', illustration: 'danger_bleeding', priority: 1 }),
    item({ id: 'med.iron_folate', category: 'medication', title: 'Iron and folic acid daily', motherText: 'Take one iron tablet every day with water or orange. It makes your blood strong.', timing: 'Every day until 3 months after birth', illustration: 'iron_tablet' }),
    item({ id: 'nut.iron_foods', category: 'nutrition', title: 'Eat iron-rich foods', motherText: 'Eat ugu or other green leaves, beans and a little liver or fish this week.', illustration: 'iron_foods' }),
    item({ id: 'rest.left_side', category: 'rest_and_sleep', title: 'Sleep on your left side', motherText: 'From now until birth, lie down to sleep on your left side.', illustration: 'sleep_left_side' }),
    item({ id: 'mal.itn', category: 'medication', title: 'Sleep under a treated net', motherText: 'Sleep under the mosquito net every night, and keep it tucked in.', illustration: 'mosquito_net' }),
    item({ id: 'prep.birth_bag', category: 'birth_preparedness', title: 'Pack your birth bag', motherText: 'Put wrappers, baby clothes, pads, soap and your card in one bag by 36 weeks.', timing: 'By 36 weeks', illustration: 'birth_bag' }),
    item({ id: 'fam.support', category: 'family_support', title: 'Let your family help', motherText: 'Ask your husband and mother-in-law to help with heavy work and to bring you to the clinic.', illustration: 'family_support' }),
  ];
  return {
    motherId: 'm-demo',
    version: 3,
    generatedAt: '2026-11-05T09:00:00Z',
    state: {
      motherId: 'm-demo',
      asOf: '2026-11-05',
      stage: 'pregnancy',
      trimester: 3,
      gestationalWeeks: 31,
      ancContactsAttended: 4,
      latest: { haemoglobin: 9.8 },
      recentSymptoms: [],
      risks: [],
    },
    summary: 'Third trimester, mild anaemia.',
    alerts: [],
    items,
    nextContact: { date: '2026-11-19', type: 'anc', label: 'ANC contact 6 (33 weeks)' },
  };
}

export function sampleHandoutInput(name?: string): HandoutInput {
  const plan = samplePlan();
  return {
    mother: sampleMother(name),
    plan,
    items: plan.items,
    language: 'en',
    brandName: 'Gaskin',
    workerName: 'Hauwa Musa, CHEW',
    facilityName: 'Dala Primary Health Centre',
    emergencyLine: '112',
  };
}
