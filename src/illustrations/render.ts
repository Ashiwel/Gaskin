/** Pictogram renderer: wraps a drawing in the shared frame. */
import type { IllustrationKey } from '../types';
import { DRAWINGS } from './drawings';
import { PALETTE } from './palette';

/** Default English titles, also used as short labels on handouts. */
export const ILLUSTRATION_LABELS: Record<IllustrationKey, string> = {
  danger_bleeding: 'Bleeding from the vagina',
  danger_headache: 'Very bad headache',
  danger_fever: 'High fever',
  danger_convulsion: 'Fits or shaking',
  danger_baby_movement: 'Baby moving less',
  danger_swelling: 'Swollen face or hands',
  danger_breathing: 'Hard to breathe',
  baby_danger: 'Baby is very sick',
  clinic_visit: 'Go to the clinic',
  iron_tablet: 'Iron tablet every day',
  medicine: 'Take your medicine',
  mosquito_net: 'Sleep under a net',
  balanced_plate: 'Eat a mixed plate',
  protein_foods: 'Eggs, beans and fish',
  iron_foods: 'Greens, beans and liver',
  water: 'Drink clean water',
  sleep_left_side: 'Sleep on your left side',
  rest: 'Rest with feet up',
  walking: 'Walk every day',
  breastfeeding: 'Breastfeed your baby',
  breastfeeding_latch: 'Good latch at the breast',
  skin_to_skin: 'Skin to skin',
  cord_care: 'Keep the cord clean and dry',
  vaccination: 'Baby vaccines',
  complementary_food: 'Soft mashed food from 6 months',
  handwashing: 'Wash hands with soap',
  family_support: 'Family helps you',
  talk_to_someone: 'Talk to someone',
  birth_bag: 'Pack your birth bag',
  blood_pressure: 'Check blood pressure',
  test_tube: 'Blood and urine tests',
  calendar: 'Remember the date',
  phone_call: 'Call for help',
  family_planning: 'Space your children',
  warm_baby: 'Keep baby warm',
  growth_chart: 'Baby growing well',
};

export const ILLUSTRATION_KEYS: IllustrationKey[] = Object.keys(ILLUSTRATION_LABELS) as IllustrationKey[];

/** Unique ids for the disc clip so several SVGs can share one HTML page. */
let clipCounter = 0;

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Returns inline SVG markup for a pictogram on a 120 x 120 viewBox.
 * size sets width/height in px (default 120); title overrides the English label.
 */
export function renderIllustration(key: IllustrationKey, opts: { size?: number; title?: string } = {}): string {
  const draw = DRAWINGS[key];
  const size = opts.size ?? 120;
  const title = escapeXml(opts.title ?? ILLUSTRATION_LABELS[key] ?? key);
  const clipId = `gk-${key}-${++clipCounter}`;
  const raw = draw ? draw() : '';
  const usesClip = raw.includes('__CLIP__');
  const body = usesClip ? raw.split('__CLIP__').join(clipId) : raw;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" data-illustration="${key}">` +
    `<title>${title}</title>` +
    (usesClip ? `<defs><clipPath id="${clipId}"><circle cx="60" cy="60" r="58"/></clipPath></defs>` : '') +
    `<circle cx="60" cy="60" r="58" fill="${PALETTE.disc}"/>` +
    `<g stroke="${PALETTE.ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body}</g>` +
    `</svg>`
  );
}
