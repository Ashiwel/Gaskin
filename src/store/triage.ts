import type { SymptomCode } from '../types';

/** Three-tier triage for anything the mother reports by message. */
export type TriageTier = 'emergency' | 'same_day' | 'next_contact';

export const TRIAGE_LABELS: Record<TriageTier, string> = {
  emergency: 'Emergency now',
  same_day: 'Same-day review',
  next_contact: 'Next contact',
};

const EMERGENCY: SymptomCode[] = [
  'vaginal_bleeding',
  'severe_headache',
  'blurred_vision',
  'convulsions',
  'severe_abdominal_pain',
  'reduced_fetal_movement',
  'breathlessness',
  'leaking_fluid',
  'heavy_postpartum_bleeding',
  'thoughts_of_self_harm',
  'calf_pain_swelling',
  'baby_not_feeding',
  'baby_cold',
  'baby_convulsions',
  'baby_fast_breathing',
  'baby_chest_indrawing',
  'baby_lethargic',
  'baby_vomiting_everything',
];

const SAME_DAY: SymptomCode[] = [
  'fever',
  'swelling_face_hands',
  'painful_urination',
  'foul_discharge',
  'breast_pain_redness',
  'low_mood',
  'anxiety',
  'low_milk_supply',
  'baby_fever',
  'baby_yellow_skin',
  'baby_cord_redness',
  'baby_diarrhoea',
];

export function triageSymptoms(symptoms: SymptomCode[] | undefined): TriageTier {
  if (!symptoms || symptoms.length === 0) return 'next_contact';
  if (symptoms.some((s) => EMERGENCY.includes(s))) return 'emergency';
  if (symptoms.some((s) => SAME_DAY.includes(s))) return 'same_day';
  return 'next_contact';
}
