import type { CountryCode } from '../types';

/**
 * Side effects by kind of recommendation, for ConstraintEvent.sideEffect.symptoms.
 * `serious: true` means stop and refer the same day whatever severity was recorded
 * (allergic or organ signs). `harmless: true` means tell her it is expected and safe.
 *
 * Sources: WHO 2012 iron and folic acid guideline and WHO ANC 2016 rec. A.2.1 (common iron side effects);
 * WHO malaria in pregnancy guidance and the SP product information (severe skin reactions, jaundice:
 * stop SP); WHO AEFI surveillance (common minor reactions versus serious events, which are reported);
 * WHO 2021 HIV guideline (ART side effects: keep taking, review at the clinic).
 */
export type SideEffectGroup = 'iron' | 'iptp' | 'vaccine' | 'art' | 'calcium' | 'aspirin' | 'other';

export interface SideEffectSymptom {
  code: string;
  label: string;
  /** Plain words for her */
  plain: string;
  serious?: boolean;
  harmless?: boolean;
  /** Emergency rather than same-day (convulsion, breathing difficulty, face swelling) */
  emergency?: boolean;
}

export interface SideEffectSpec {
  group: SideEffectGroup;
  label: string;
  symptoms: SideEffectSymptom[];
  /** Mild: practical tips and continue (worker text) */
  mild: string;
  /** Moderate: adjust within guidelines and review */
  moderate: string;
  /** Severe or a serious symptom: stop and refer */
  severe: string;
  /** Mother-facing template keys in PLAN_TEXT */
  keys: { mild: string; moderate: string; severe: string };
  /** Adverse events following immunisation and serious drug reactions are reported */
  reportable: boolean;
  sources: string[];
}

const SERIOUS_ALLERGY: SideEffectSymptom[] = [
  { code: 'face_swelling', label: 'Swelling of face, lips or tongue', plain: 'swollen face or lips', serious: true, emergency: true },
  { code: 'breathing_difficulty', label: 'Difficulty breathing or wheeze', plain: 'hard breathing', serious: true, emergency: true },
  { code: 'blistering_rash', label: 'Rash with blisters or peeling skin', plain: 'skin blisters or peeling', serious: true, emergency: true },
];

export const SIDE_EFFECTS: Record<SideEffectGroup, SideEffectSpec> = {
  iron: {
    group: 'iron',
    label: 'Iron and folic acid',
    symptoms: [
      { code: 'nausea', label: 'Nausea', plain: 'feeling sick' },
      { code: 'constipation', label: 'Constipation', plain: 'hard stool' },
      { code: 'stomach_pain', label: 'Stomach pain or heartburn', plain: 'stomach pain' },
      { code: 'black_stools', label: 'Black stools (expected, harmless)', plain: 'black stool', harmless: true },
      { code: 'diarrhoea', label: 'Loose stools', plain: 'loose stool' },
      ...SERIOUS_ALLERGY,
    ],
    mild: 'Common and usually settles in 1–2 weeks. Take it at night or with food (not with tea, coffee, pap or calcium tablets); for constipation, more water, fruit, beans and leafy vegetables, and walking. Black stools are expected and harmless. Keep taking it.',
    moderate: 'Still troubling after these tips: keep a daily dose but try taking it at bedtime with a small meal; ask the facility about a different iron preparation or alternate-day dosing for prevention (WHO 2016 allows intermittent iron where daily is not acceptable). Review at the next contact; recheck Hb.',
    severe: 'Stop the tablet and refer the same day: possible allergy or another cause for the symptoms. Do not stop iron for ordinary nausea or constipation.',
    keys: { mild: 'se.iron.mild', moderate: 'se.iron.moderate', severe: 'se.severe' },
    reportable: false,
    sources: ['who-ifa-2012', 'who-anc-2016-a21'],
  },
  iptp: {
    group: 'iptp',
    label: 'IPTp-SP (malaria prevention)',
    symptoms: [
      { code: 'nausea', label: 'Nausea or vomiting', plain: 'feeling sick' },
      { code: 'dizziness', label: 'Dizziness', plain: 'dizzy' },
      { code: 'itching', label: 'Itching', plain: 'itching' },
      { code: 'rash', label: 'Skin rash', plain: 'skin rash', serious: true },
      { code: 'yellow_eyes', label: 'Yellow eyes or skin', plain: 'yellow eyes', serious: true },
      ...SERIOUS_ALLERGY,
    ],
    mild: 'Mild nausea or dizziness after SP passes in a day. Give SP with food and clean water under direct observation.',
    moderate: 'Itching without rash: review before the next dose. Do not give the next SP dose until a clinician has seen her.',
    severe: 'Any rash, yellow eyes or skin, or swelling: stop SP for good (never give it again), refer the same day, and record it as a drug reaction. Protect her from malaria with a treated net and prompt testing for fever.',
    keys: { mild: 'se.iptp.mild', moderate: 'se.iptp.moderate', severe: 'se.iptp.severe' },
    reportable: true,
    sources: ['who-anc-2016-c6', 'ng-mip-2018'],
  },
  vaccine: {
    group: 'vaccine',
    label: 'Vaccines (adverse events following immunisation)',
    symptoms: [
      { code: 'fever', label: 'Mild fever', plain: 'mild fever' },
      { code: 'swelling', label: 'Swelling or pain where the injection was given', plain: 'sore swollen leg or arm' },
      { code: 'crying', label: 'Crying, fussy', plain: 'crying a lot' },
      { code: 'bcg_sore', label: 'Small sore at the BCG site after 2–6 weeks (expected)', plain: 'small sore on the arm', harmless: true },
      { code: 'high_fever', label: 'Fever 39 °C or more', plain: 'very hot body', serious: true },
      { code: 'convulsion', label: 'Convulsion (fit)', plain: 'fits', serious: true, emergency: true },
      { code: 'floppy', label: 'Floppy, pale or unresponsive', plain: 'floppy or will not wake', serious: true, emergency: true },
      { code: 'nonstop_crying', label: 'Crying without stopping for 3 hours or more', plain: 'crying for hours without stopping', serious: true },
      ...SERIOUS_ALLERGY,
    ],
    mild: 'Common reactions settle in 1–2 days: keep breastfeeding, light clothing, a cool cloth on the leg; paracetamol at the child dose only if the facility advises. The BCG sore heals by itself; keep it clean and dry, nothing on it. Do not skip the next vaccines.',
    moderate: 'Larger swelling or fever lasting more than 2 days: see the child today at the clinic. Give the next doses on schedule unless a clinician says otherwise.',
    severe: 'Serious reaction: emergency referral now. Record it as an adverse event following immunisation (AEFI) and report it through the facility to the national system the same day.',
    keys: { mild: 'se.vaccine.mild', moderate: 'se.vaccine.moderate', severe: 'se.vaccine.severe' },
    reportable: true,
    sources: ['who-pnc-2022-rec34', 'who-aefi-manual'],
  },
  art: {
    group: 'art',
    label: 'HIV treatment (ART)',
    symptoms: [
      { code: 'nausea', label: 'Nausea', plain: 'feeling sick' },
      { code: 'headache', label: 'Headache', plain: 'headache' },
      { code: 'sleep', label: 'Trouble sleeping or bad dreams', plain: 'poor sleep' },
      { code: 'yellow_eyes', label: 'Yellow eyes or skin', plain: 'yellow eyes', serious: true },
      { code: 'rash', label: 'Skin rash', plain: 'skin rash', serious: true },
      ...SERIOUS_ALLERGY,
    ],
    mild: 'Usually settles in the first weeks. Keep taking ART every day: stopping risks passing HIV to the baby. Take it at the same time each day; with food if it upsets the stomach.',
    moderate: 'Refer to the ART clinic this week to review the regimen. Do not stop ART while waiting.',
    severe: 'Rash, yellow eyes or swelling: refer to the ART clinic or hospital today. Do not stop ART without a clinician.',
    keys: { mild: 'se.art.mild', moderate: 'se.art.moderate', severe: 'se.severe' },
    reportable: true,
    sources: ['who-hiv-2021'],
  },
  calcium: {
    group: 'calcium',
    label: 'Calcium',
    symptoms: [
      { code: 'constipation', label: 'Constipation', plain: 'hard stool' },
      { code: 'bloating', label: 'Bloating or wind', plain: 'bloating' },
      ...SERIOUS_ALLERGY,
    ],
    mild: 'Take with meals, split into doses, and at least 2 hours away from the iron tablet. More water and fruit for constipation.',
    moderate: 'Review the dose and timing at the next contact.',
    severe: 'Stop and refer the same day.',
    keys: { mild: 'se.calcium.mild', moderate: 'se.generic.moderate', severe: 'se.severe' },
    reportable: false,
    sources: ['who-anc-2016-a3'],
  },
  aspirin: {
    group: 'aspirin',
    label: 'Low-dose aspirin',
    symptoms: [
      { code: 'stomach_pain', label: 'Stomach upset', plain: 'stomach pain' },
      { code: 'bleeding_gums', label: 'Bleeding gums or nosebleeds', plain: 'bleeding gums' },
      { code: 'black_stools', label: 'Black stools or vomiting blood', plain: 'black stool or blood in vomit', serious: true },
      ...SERIOUS_ALLERGY,
    ],
    mild: 'Take at night with food.',
    moderate: 'Review with the prescriber this week; do not stop without advice.',
    severe: 'Stop and refer the same day (possible bleeding or allergy).',
    keys: { mild: 'se.aspirin.mild', moderate: 'se.generic.moderate', severe: 'se.severe' },
    reportable: true,
    sources: ['who-aspirin-2021'],
  },
  other: {
    group: 'other',
    label: 'Other medicine',
    symptoms: [{ code: 'other', label: 'Other side effect', plain: 'other problem' }, ...SERIOUS_ALLERGY],
    mild: 'Practical tips and continue; review at the next contact.',
    moderate: 'Review with the prescriber within a week.',
    severe: 'Stop and refer the same day.',
    keys: { mild: 'se.generic.mild', moderate: 'se.generic.moderate', severe: 'se.severe' },
    reportable: true,
    sources: ['who-anc-2016'],
  },
};

/** Which side-effect group a plan item or constraint target belongs to. */
export function sideEffectGroup(itemId: string): SideEffectGroup {
  const id = itemId.replace(/@.*$/, '');
  if (/iron|ifa|folic|ferrous/.test(id)) return 'iron';
  if (/iptp|\bsp\b/.test(id)) return 'iptp';
  if (/^imm\.|^d\.vaccine|vaccin|^d\.td/.test(id)) return 'vaccine';
  if (/art|arv|pmtct/.test(id)) return 'art';
  if (/calcium/.test(id)) return 'calcium';
  if (/aspirin/.test(id)) return 'aspirin';
  return 'other';
}

/**
 * Where to report an adverse event. Nigeria's NAFDAC Pharmacovigilance Directorate receives ADR and AEFI
 * reports (verified on nafdac.gov.ng, Nov 2026); elsewhere we say "through your facility".
 */
export const ADVERSE_EVENT_REPORTING: Record<CountryCode | 'default', string> = {
  NG: 'Report through your facility to the NAFDAC Pharmacovigilance Directorate (e-reporting on nafdac.gov.ng, or the ADR form at a zonal pharmacovigilance centre; enquiries 0700-1-623322). Vaccine reactions also go to the LGA immunisation officer as an AEFI.',
  KE: 'Report through your facility to the national pharmacovigilance and AEFI system.',
  GH: 'Report through your facility to the national pharmacovigilance and AEFI system.',
  default: 'Report through your facility to the national pharmacovigilance and AEFI system.',
};
