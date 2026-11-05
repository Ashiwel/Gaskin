import type { ClinicalEvent, Mother } from '../types';

/** Minimal valid mother for tests; override any field. */
export function makeMother(over: Partial<Mother> = {}): Mother {
  return {
    id: 'm1',
    name: 'Amaka Okafor',
    age: 26,
    country: 'NG',
    region: 'Enugu',
    community: 'Nsukka',
    language: 'en',
    literacy: 'good',
    phone: { access: 'feature', hasWhatsApp: false },
    incomeBand: 'middle',
    gravida: 2,
    parity: 1,
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    conditions: [],
    allergies: [],
    genotype: 'AA',
    heightCm: 160,
    prePregnancyWeightKg: 60,
    medications: [],
    children: [],
    practicesMentioned: [],
    assignedWorkerId: 'w1',
    facilityId: 'f1',
    enrolledAt: '2026-06-01',
    consent: { dataProcessing: true, messaging: true, recordedAt: '2026-06-01', recordedBy: 'w1' },
    events: [],
    ...over,
  };
}

let n = 0;
export function ev<E extends ClinicalEvent>(e: Omit<E, 'id' | 'recordedBy'> & { recordedBy?: string }): E {
  n += 1;
  return { id: `e${n}`, recordedBy: 'w1', ...e } as E;
}
