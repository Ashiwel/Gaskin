/**
 * Small shared helpers: language names, channel limits, picking the plan
 * items a message covers, and a tolerant JSON parser for model replies.
 */
import type { Alert, CarePlan, Channel, LanguageCode, Mother, PlanItem } from '../types';

export const AI_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  pcm: 'Nigerian Pidgin',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
  sw: 'Swahili',
  tw: 'Twi',
  bin: 'Edo (Bini)',
  urh: 'Urhobo',
  ar: 'Arabic',
  dag: 'Dagbani',
  luo: 'Dholuo',
  ee: 'Ewe',
  ff: 'Fulfulde',
};

/** Default maximum characters per channel when the caller gives none */
export const DEFAULT_MAX_CHARS: Record<Channel, number> = {
  sms: 306, // two GSM-7 segments
  whatsapp: 700,
  email: 1500,
  voice: 600,
  print: 1200,
};

export function firstName(mother: Mother): string {
  return (mother.name || '').trim().split(/\s+/)[0] || 'Mama';
}

export function stageDescription(plan: CarePlan): string {
  const s = plan.state;
  switch (s.stage) {
    case 'pregnancy':
      return s.gestationalWeeks != null
        ? `pregnant, ${s.gestationalWeeks} weeks${s.trimester ? ` (trimester ${s.trimester})` : ''}`
        : 'pregnant';
    case 'postpartum':
      return s.daysPostpartum != null ? `${s.daysPostpartum} days after giving birth` : 'recently gave birth';
    case 'infant':
      return s.infantAgeDays != null ? `mother of a baby aged ${formatAge(s.infantAgeDays)}` : 'mother of a young baby';
    case 'preconception':
    default:
      return 'planning a pregnancy';
  }
}

function formatAge(days: number): string {
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30.4);
  return `${months} months`;
}

/** Active items the message should cover, in priority order */
export function selectItems(plan: CarePlan, itemIds: string[] | undefined): PlanItem[] {
  const active = plan.items.filter((i) => i.status === 'active');
  let chosen: PlanItem[];
  if (itemIds && itemIds.length) {
    const want = new Set(itemIds);
    chosen = active.filter((i) => want.has(i.id));
  } else {
    chosen = active.filter((i) => i.audience !== 'worker').slice();
    chosen.sort((a, b) => a.priority - b.priority);
    chosen = chosen.slice(0, 4);
  }
  return chosen.sort((a, b) => a.priority - b.priority);
}

export function seriousAlerts(plan: CarePlan): Alert[] {
  return plan.alerts.filter((a) => a.level === 'emergency' || a.level === 'urgent');
}

export function topAlertLevel(plan: CarePlan): Alert['level'] | undefined {
  if (plan.alerts.some((a) => a.level === 'emergency')) return 'emergency';
  if (plan.alerts.some((a) => a.level === 'urgent')) return 'urgent';
  if (plan.alerts.some((a) => a.level === 'warning')) return 'warning';
  return undefined;
}

/**
 * Parse a model reply as JSON: the whole reply, else a fenced block, else
 * the span from the first { or [ to the last } or ]. Throws if none parse.
 */
export function parseJsonLoose<T = unknown>(raw: string): T {
  const text = raw.trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    /* continue */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      /* continue */
    }
  }
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0);
  const ends = [text.lastIndexOf('}'), text.lastIndexOf(']')].filter((i) => i >= 0);
  if (starts.length && ends.length) {
    const s = Math.min(...starts);
    const e = Math.max(...ends);
    if (e > s) return JSON.parse(text.slice(s, e + 1)) as T;
  }
  throw new Error('Reply did not contain JSON');
}

/** Strip wrapping quotes, markdown fences and stray labels a model may add around a message */
export function cleanMessage(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```$/, '').trim();
  t = t.replace(/^(?:message|here is the message|sms|whatsapp message)\s*:\s*/i, '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”'))) t = t.slice(1, -1).trim();
  return t;
}
