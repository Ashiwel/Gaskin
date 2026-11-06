/**
 * WHO Child Growth Standards, weight-for-age, birth to 24 months (kg): −3, −2, median, +2 and +3 SD,
 * from the WHO z-score tables (who.int/tools/child-growth-standards/standards/weight-for-age).
 * If src/clinical later ships full monthly tables, prefer those.
 */
import type { GrowthReferenceRow } from '../../components/viz';

const row = (month: number, minus3: number, minus2: number, median: number, plus2: number, plus3: number): GrowthReferenceRow => ({ month, minus3, minus2, median, plus2, plus3 });

export const WHO_WFA: Record<'F' | 'M', GrowthReferenceRow[]> = {
  F: [
    row(0, 2.0, 2.4, 3.2, 4.2, 4.8),
    row(1, 2.7, 3.2, 4.2, 5.5, 6.2),
    row(2, 3.4, 3.9, 5.1, 6.6, 7.5),
    row(3, 4.0, 4.5, 5.8, 7.5, 8.5),
    row(4, 4.4, 5.0, 6.4, 8.2, 9.3),
    row(6, 5.1, 5.7, 7.3, 9.3, 10.6),
    row(9, 5.8, 6.5, 8.2, 10.5, 12.0),
    row(12, 6.3, 7.0, 8.9, 11.5, 13.1),
    row(15, 6.7, 7.6, 9.6, 12.4, 14.1),
    row(18, 7.2, 8.1, 10.2, 13.2, 15.1),
    row(21, 7.6, 8.6, 10.9, 14.0, 16.0),
    row(24, 8.1, 9.0, 11.5, 14.8, 17.0),
  ],
  M: [
    row(0, 2.1, 2.5, 3.3, 4.4, 5.0),
    row(1, 2.9, 3.4, 4.5, 5.8, 6.6),
    row(2, 3.8, 4.3, 5.6, 7.1, 8.0),
    row(3, 4.4, 5.0, 6.4, 8.0, 9.0),
    row(4, 4.9, 5.6, 7.0, 8.7, 9.7),
    row(6, 5.7, 6.4, 7.9, 9.8, 10.9),
    row(9, 6.4, 7.1, 8.9, 11.0, 12.3),
    row(12, 6.9, 7.7, 9.6, 12.0, 13.3),
    row(15, 7.4, 8.3, 10.3, 12.8, 14.3),
    row(18, 7.8, 8.8, 10.9, 13.7, 15.3),
    row(21, 8.2, 9.2, 11.5, 14.5, 16.2),
    row(24, 8.6, 9.7, 12.2, 15.3, 17.1),
  ],
};

/** Rows up to a little past the child's age, so the chart is not squashed for a newborn. */
export function referenceFor(sex: 'F' | 'M', ageMonths: number): GrowthReferenceRow[] {
  const until = Math.min(24, Math.max(4, Math.ceil(ageMonths + 2)));
  const rows = WHO_WFA[sex].filter((r) => r.month <= until);
  const next = WHO_WFA[sex].find((r) => r.month > until);
  return next && rows[rows.length - 1].month < until ? [...rows, next] : rows;
}
