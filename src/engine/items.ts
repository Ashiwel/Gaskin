import type { Citation, CountryCode, EvidenceGrade, IllustrationKey, PlanCategory, PlanItem, PatientState } from '../types';
import type { CountryRules } from '../clinical';
import type { AlertWithShort } from './alerts';
import type { Facts } from './facts';
import { MOTHER_TEXT, renderMotherText } from '../clinical';

/**
 * Optional location hook: what is grown, sold and practised where she lives.
 * Foods are preferred in nutrition advice; practices are surfaced as things to ask about.
 */
export interface LocationProfile {
  country: CountryCode;
  region: string;
  localFoods?: { name: string; nutrients: string[]; season?: string; costTier?: string }[];
  /** Traditional practice ids common in this area */
  practices?: string[];
  /** Overrides the country default for IPTp eligibility */
  malariaEndemic?: boolean;
}

/** Shared context for all rule functions. */
export interface RuleCtx {
  f: Facts;
  s: PatientState;
  alerts: AlertWithShort[];
  rules: CountryRules;
  /** literacy none/basic: shorter mother text */
  simple: boolean;
  items: PlanItem[];
  location?: LocationProfile;
}

export interface ItemInput {
  id: string;
  category: PlanCategory;
  title: string;
  detail: string;
  /** Mother text template (key in MOTHER_TEXT) and params; with literacy none/basic, `${key}.simple` is used when it exists */
  text: { key: string; params?: Record<string, string | number> };
  priority: PlanItem['priority'];
  audience?: PlanItem['audience'];
  timing?: string;
  dueDate?: string;
  evidence: EvidenceGrade;
  sources: Citation[];
  because: string[];
  locked?: boolean;
  origin?: PlanItem['origin'];
  illustration?: IllustrationKey;
  status?: PlanItem['status'];
}

export function addItem(c: RuleCtx, i: ItemInput): PlanItem {
  const existing = c.items.find((x) => x.id === i.id);
  if (existing) return existing; // first rule to claim an id wins; keeps ids unique
  const item: PlanItem = {
    id: i.id,
    category: i.category,
    title: i.title,
    detail: i.detail,
    ...motherTextFor(c.simple, i.text.key, i.text.params),
    priority: i.priority,
    audience: i.audience ?? 'both',
    timing: i.timing,
    dueDate: i.dueDate,
    evidence: i.evidence,
    sources: i.sources,
    because: i.because.filter(Boolean),
    locked: i.locked || undefined,
    origin: i.origin ?? 'guideline',
    illustration: i.illustration,
    status: i.status ?? 'active',
  };
  c.items.push(item);
  return item;
}

/** Render the mother text, choosing the '.simple' template for low literacy when one exists. */
export function motherTextFor(simple: boolean, key: string, params?: Record<string, string | number>): Pick<PlanItem, 'motherText' | 'motherTextKey' | 'motherTextParams'> {
  const k = simple && MOTHER_TEXT[`${key}.simple`] !== undefined ? `${key}.simple` : key;
  return { motherText: renderMotherText(k, params), motherTextKey: k, ...(params && Object.keys(params).length ? { motherTextParams: params } : {}) };
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
