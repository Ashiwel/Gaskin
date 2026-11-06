/**
 * Sample reference data for the #design showcase only.
 * WHO Child Growth Standards, weight-for-age, girls, birth to 24 months (kg): median, -2 SD, +2 SD,
 * -3 SD and +3 SD, from the WHO z-score tables (who.int/tools/child-growth-standards). Screens that
 * draw real growth charts should take the full monthly tables from src/clinical, not from here.
 */
import type { GrowthReferenceRow } from '../components/viz';

export const WHO_WFA_GIRLS_0_24: GrowthReferenceRow[] = [
  { month: 0, minus3: 2.0, minus2: 2.4, median: 3.2, plus2: 4.2, plus3: 4.8 },
  { month: 1, minus3: 2.7, minus2: 3.2, median: 4.2, plus2: 5.5, plus3: 6.2 },
  { month: 2, minus3: 3.4, minus2: 3.9, median: 5.1, plus2: 6.6, plus3: 7.5 },
  { month: 3, minus3: 4.0, minus2: 4.5, median: 5.8, plus2: 7.5, plus3: 8.5 },
  { month: 4, minus3: 4.4, minus2: 5.0, median: 6.4, plus2: 8.2, plus3: 9.3 },
  { month: 6, minus3: 5.1, minus2: 5.7, median: 7.3, plus2: 9.3, plus3: 10.6 },
  { month: 9, minus3: 5.8, minus2: 6.5, median: 8.2, plus2: 10.5, plus3: 12.0 },
  { month: 12, minus3: 6.3, minus2: 7.0, median: 8.9, plus2: 11.5, plus3: 13.1 },
  { month: 15, minus3: 6.7, minus2: 7.6, median: 9.6, plus2: 12.4, plus3: 14.1 },
  { month: 18, minus3: 7.2, minus2: 8.1, median: 10.2, plus2: 13.2, plus3: 15.1 },
  { month: 21, minus3: 7.6, minus2: 8.6, median: 10.9, plus2: 14.0, plus3: 16.0 },
  { month: 24, minus3: 8.1, minus2: 9.0, median: 11.5, plus2: 14.8, plus3: 17.0 },
];
