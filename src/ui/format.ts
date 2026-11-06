import type { Mother, PatientState, CarePlan, Alert } from '../types';

const DAY = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
}

export function daysBetween(a: string, b: string): number {
  const da = toDate(a);
  const db = toDate(b);
  const ua = Date.UTC(da.getUTCFullYear(), da.getUTCMonth(), da.getUTCDate());
  const ub = Date.UTC(db.getUTCFullYear(), db.getUTCMonth(), db.getUTCDate());
  return Math.round((ub - ua) / DAY);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}

export function fmtDate(iso?: string, opts: { year?: boolean; weekday?: boolean } = {}): string {
  if (!iso) return '';
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: opts.year ? 'numeric' : undefined,
    weekday: opts.weekday ? 'long' : undefined,
    timeZone: 'UTC',
  });
}

export function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = toDate(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

/** "today", "tomorrow", "in 3 days", "2 days ago" relative to the demo clock */
export function relDay(iso: string | undefined, clock: string): string {
  if (!iso) return '';
  const n = daysBetween(clock, iso);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n < 14) return `in ${n} days`;
  if (n < -1 && n > -14) return `${-n} days ago`;
  if (n >= 14) return `in ${Math.round(n / 7)} weeks`;
  return `${Math.round(-n / 7)} weeks ago`;
}

export function obstetricShort(m: Mother): string {
  return `G${m.gravida}P${m.parity}`;
}

export function babyAge(days?: number): string {
  if (days === undefined) return '';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`;
  if (days < 7 * 13) return `${Math.floor(days / 7)} weeks old`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months old`;
  return `${Math.floor(months / 12)} years old`;
}

export function stageLine(m: Mother, s: PatientState): string {
  const ob = obstetricShort(m);
  switch (s.stage) {
    case 'pregnancy':
      return `${s.gestationalWeeks ?? '?'} wks · ${ob}`;
    case 'postpartum':
      return `Day ${s.daysPostpartum ?? 0} after birth · ${ob}`;
    case 'infant':
      return `Baby ${babyAge(s.infantAgeDays)} · ${ob}`;
    default:
      return `Planning a pregnancy · ${ob}`;
  }
}

export const STAGE_LABELS: Record<PatientState['stage'], string> = {
  preconception: 'Before pregnancy',
  pregnancy: 'Pregnant',
  postpartum: 'After birth',
  infant: 'Baby under 2',
};

export type Urgency = 'emergency' | 'urgent' | 'overdue' | 'today' | 'rest';

export const URGENCY_LABELS: Record<Urgency, string> = {
  emergency: 'Emergency',
  urgent: 'Urgent',
  overdue: 'Overdue contact',
  today: 'Due today',
  rest: 'Coming up',
};

export function urgencyOf(plan: CarePlan, clock: string): Urgency {
  if (plan.alerts.some((a) => a.level === 'emergency')) return 'emergency';
  if (plan.alerts.some((a) => a.level === 'urgent')) return 'urgent';
  const nc = plan.nextContact?.date;
  if (nc) {
    const d = daysBetween(clock, nc);
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
  }
  return 'rest';
}

export const URGENCY_RANK: Record<Urgency, number> = { emergency: 0, urgent: 1, overdue: 2, today: 3, rest: 4 };

export function topAlert(alerts: Alert[]): Alert | undefined {
  const order = { emergency: 0, urgent: 1, warning: 2 } as const;
  return [...alerts].sort((a, b) => order[a.level] - order[b.level])[0];
}

/** A short stable identifier that is not her phone number and survives SIM changes. */
export function gaskinId(m: Mother): string {
  let h = 2166136261;
  for (const ch of m.id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY3479';
  let n = h >>> 0;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return `GSK-${m.country}-${out.slice(0, 3)}-${out.slice(3)}`;
}

/** "Dr Funmi Bello" -> "Funmi Bello", so sign-offs use a real first name. */
export function withoutTitle(name: string): string {
  return name.replace(/^(dr|mrs|mr|ms|miss|nurse|sister|matron|prof)\.?\s+/i, '').trim() || name;
}

/** "Surulere (Aguda), Lagos" without repeating the region if the community already names it. */
export function place(m: { community: string; region: string }): string {
  return m.community.toLowerCase().includes(m.region.toLowerCase()) ? m.community : `${m.community}, ${m.region}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function money(n: number, symbol: string): string {
  const digits = n < 10 ? 2 : n < 100 ? 1 : 0;
  return `${symbol}${n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function usd(n: number): string {
  return `$${n.toLocaleString('en-GB', { minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: n < 1 ? 3 : 2 })}`;
}

export function pct(n: number, d: number): string {
  if (!d) return '–';
  return `${Math.round((n / d) * 100)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const PHONE_ACCESS_LABELS: Record<Mother['phone']['access'], string> = {
  none: 'No phone',
  shared: 'Shared phone',
  feature: 'Basic phone (SMS)',
  smartphone: 'Smartphone',
};

export const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  whatsapp: 'Chat app',
  email: 'Email',
  voice: 'Voice call',
  print: 'Printed handout',
};

// ---------- Small helpers for the redesigned Today, Mothers and Visits screens ----------

export function firstName(name: string): string {
  return withoutTitle(name).split(/\s+/)[0] ?? name;
}

/** "Good morning" by the demo clock's hour (UTC, as the rest of the demo). */
export function greeting(clock: string): string {
  const h = toDate(clock).getUTCHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Compact age: "5 days", "6 wks", "8 mths", "1 yr 3 mths". */
export function shortAge(days: number): string {
  if (days < 0) return 'due';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 91) return `${Math.floor(days / 7)} wks`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} mths`;
  const y = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${y} yr ${rest} mth${rest === 1 ? '' : 's'}` : `${y} yr${y === 1 ? '' : 's'}`;
}

/** Where she is in the first 1,000 days, as days from conception (pregnancy is roughly 266 days). */
export function journeyDay(m: Mother, s: PatientState, clock: string): number | undefined {
  if (s.stage === 'pregnancy') {
    const lmp = m.pregnancy?.lmp;
    const d = lmp ? daysBetween(lmp, clock) - 14 : (s.gestationalWeeks ?? 0) * 7 - 14;
    return Math.max(0, Math.min(266, d));
  }
  if (s.stage === 'postpartum' || s.stage === 'infant') {
    const age = s.infantAgeDays ?? s.daysPostpartum ?? 0;
    return Math.min(1000, 266 + Math.max(0, age));
  }
  return undefined;
}

export type ChipColor = 'brand' | 'pink' | 'blue' | 'gray';

/** The stage as a short chip: "31 wks", "Day 5", "Baby 6 mths", "Planning". */
export function stageChip(s: PatientState): { label: string; color: ChipColor; long: string } {
  switch (s.stage) {
    case 'pregnancy':
      return { label: `${s.gestationalWeeks ?? '?'} wks`, color: 'brand', long: `Pregnant, ${s.gestationalWeeks ?? '?'} weeks` };
    case 'postpartum':
      return { label: `Day ${s.daysPostpartum ?? 0}`, color: 'pink', long: `Day ${s.daysPostpartum ?? 0} after birth` };
    case 'infant':
      return { label: `Baby ${shortAge(s.infantAgeDays ?? 0)}`, color: 'blue', long: `Baby ${babyAge(s.infantAgeDays)}` };
    default:
      return { label: 'Planning', color: 'gray', long: 'Planning a pregnancy' };
  }
}

/** Trim a worker-facing reason to a few words for a card. */
export function shortReason(text: string, max = 56): string {
  const t = text
    .replace(/^High risk:\s*/i, '')
    .replace(/^Urgent:\s*/i, '')
    .replace(/^Follow-up:\s*/i, '')
    .trim();
  const first = t.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
  const cap = first.charAt(0).toUpperCase() + first.slice(1);
  return cap.length > max ? `${cap.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '')}…` : cap;
}

/** ISO date (YYYY-MM-DD) of an ISO datetime. */
export function isoDay(iso: string): string {
  return toDate(iso).toISOString().slice(0, 10);
}
