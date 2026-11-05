/** Plain date arithmetic on ISO strings, in UTC days. No date library, fully deterministic. */

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Midnight UTC (ms) of the calendar day in an ISO date or datetime string. */
export function dayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Full timestamp (ms); date-only strings are treated as midnight UTC. */
export function timeMs(iso: string): number {
  const t = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(t) ? dayMs(iso) : t;
}

/** Whole days from a to b (b - a), by calendar day. */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayMs(b) - dayMs(a)) / DAY_MS);
}

export function addDays(iso: string, n: number): string {
  return new Date(dayMs(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

export function isoDate(iso: string): string {
  return new Date(dayMs(iso)).toISOString().slice(0, 10);
}

/** '12 Nov' style label for worker text. */
export function shortDate(iso: string): string {
  const d = new Date(dayMs(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Completed weeks of gestation from LMP (Naegele convention, 28+3 -> 28). */
export function gestationalWeeks(lmp: string, asOf: string): number {
  return Math.max(0, Math.floor(daysBetween(lmp, asOf) / 7));
}

/** Estimated date of delivery: LMP + 280 days. */
export function eddFromLmp(lmp: string): string {
  return addDays(lmp, 280);
}

/** Human age for a baby: '9 days', '5 weeks', '7 months'. */
export function babyAge(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 92) return `${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30.4);
  return months >= 24 ? `${Math.floor(months / 12)} years` : `${months} months`;
}

export function ordinal(n: number): string {
  const words = ['zero', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  return words[n] ?? `${n}th`;
}
