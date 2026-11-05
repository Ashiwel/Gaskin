import type { CountryCode } from '../types';

export interface ImmunisationVisit {
  ageDays: number;
  label: string;
  vaccines: string[];
}

/**
 * Routine childhood schedules to 2 years (the 1,000-day window).
 * Vitamin A is listed with vaccines because it is given at the same EPI visits.
 * NG: NPHCDA schedule via Nigeria Immunization FHIR IG (cite 'ng-nphcda-immunisation').
 * KE: KEPI, including 1 Nov 2025 changes (IPV2 at 9 months; R21 malaria vaccine in endemic sub-counties only).
 * GH: Ghana Health Service EPI schedule (malaria vaccine being phased in).
 */
export const IMMUNISATION_SCHEDULES: Record<CountryCode, ImmunisationVisit[]> = {
  NG: [
    { ageDays: 0, label: 'At birth', vaccines: ['BCG', 'OPV0', 'HepB0'] },
    { ageDays: 42, label: '6 weeks', vaccines: ['Penta1', 'PCV1', 'OPV1', 'Rota1', 'IPV1'] },
    { ageDays: 70, label: '10 weeks', vaccines: ['Penta2', 'PCV2', 'OPV2', 'Rota2'] },
    { ageDays: 98, label: '14 weeks', vaccines: ['Penta3', 'PCV3', 'OPV3', 'Rota3', 'IPV2'] },
    { ageDays: 152, label: '5 months', vaccines: ['Malaria1'] },
    { ageDays: 182, label: '6 months', vaccines: ['VitA-100k', 'Malaria2'] },
    { ageDays: 213, label: '7 months', vaccines: ['Malaria3'] },
    { ageDays: 274, label: '9 months', vaccines: ['MCV1', 'YF', 'MenA'] },
    { ageDays: 365, label: '12 months', vaccines: ['VitA-200k'] },
    { ageDays: 456, label: '15 months', vaccines: ['MCV2', 'Malaria4'] },
  ],
  KE: [
    { ageDays: 0, label: 'At birth', vaccines: ['BCG', 'OPV0'] },
    { ageDays: 42, label: '6 weeks', vaccines: ['Penta1', 'OPV1', 'PCV1', 'Rota1'] },
    { ageDays: 70, label: '10 weeks', vaccines: ['Penta2', 'OPV2', 'PCV2', 'Rota2'] },
    { ageDays: 98, label: '14 weeks', vaccines: ['Penta3', 'OPV3', 'PCV3', 'Rota3', 'IPV1'] },
    { ageDays: 182, label: '6 months', vaccines: ['VitA-100k', 'Malaria1 (endemic sub-counties)'] },
    { ageDays: 213, label: '7 months', vaccines: ['Malaria2 (endemic sub-counties)'] },
    { ageDays: 274, label: '9 months', vaccines: ['MR1', 'IPV2', 'Malaria3 (endemic sub-counties)', 'YF (high-risk counties)'] },
    { ageDays: 365, label: '12 months', vaccines: ['VitA-200k', 'Deworming'] },
    { ageDays: 548, label: '18 months', vaccines: ['MR2'] },
    { ageDays: 730, label: '24 months', vaccines: ['Malaria4 (endemic sub-counties)'] },
  ],
  GH: [
    { ageDays: 0, label: 'At birth', vaccines: ['BCG', 'OPV0', 'HepB0'] },
    { ageDays: 42, label: '6 weeks', vaccines: ['Penta1', 'OPV1', 'PCV1', 'Rota1'] },
    { ageDays: 70, label: '10 weeks', vaccines: ['Penta2', 'OPV2', 'PCV2', 'Rota2'] },
    { ageDays: 98, label: '14 weeks', vaccines: ['Penta3', 'OPV3', 'PCV3', 'Rota3', 'IPV1'] },
    { ageDays: 182, label: '6 months', vaccines: ['VitA-100k', 'Malaria1'] },
    { ageDays: 213, label: '7 months', vaccines: ['Malaria2', 'IPV2'] },
    { ageDays: 274, label: '9 months', vaccines: ['MR1', 'YF', 'Malaria3'] },
    { ageDays: 365, label: '12 months', vaccines: ['VitA-200k'] },
    { ageDays: 548, label: '18 months', vaccines: ['MR2', 'MenA', 'Malaria4', 'VitA-200k', 'LLIN'] },
    { ageDays: 730, label: '24 months', vaccines: ['VitA-200k'] },
  ],
};

export const IMMUNISATION_SOURCE: Record<CountryCode, string> = {
  NG: 'ng-nphcda-immunisation',
  KE: 'ke-kepi',
  GH: 'gh-ghs-immunisation',
};

/** Plain names for vaccine codes, for worker detail text. */
export const VACCINE_NAMES: Record<string, string> = {
  BCG: 'BCG (TB)',
  OPV0: 'oral polio (birth dose)',
  HepB0: 'hepatitis B birth dose (within 24 hours)',
  Penta: 'pentavalent (DTP-HepB-Hib)',
  PCV: 'pneumococcal',
  OPV: 'oral polio',
  Rota: 'rotavirus',
  IPV: 'injectable polio',
  Malaria: 'malaria vaccine',
  'VitA-100k': 'vitamin A 100,000 IU',
  'VitA-200k': 'vitamin A 200,000 IU',
  MCV: 'measles',
  MR: 'measles-rubella',
  YF: 'yellow fever',
  MenA: 'meningitis A',
  LLIN: 'treated bed net',
  Deworming: 'deworming',
};

/** Normalise a vaccine label for matching against recorded doses ('Malaria1 (endemic…)' -> 'MALARIA1'). */
export function vaccineKey(v: string): string {
  return v.split(' ')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
