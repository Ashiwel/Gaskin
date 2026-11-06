/**
 * Thin adapters for modules that are landing in parallel (src/auth, src/legal, GUIDES in
 * src/clinical/guides.ts, summariseChecklist in src/visits, children in the engine). Each is
 * loaded with an eager `import.meta.glob`, which resolves to nothing while the file is missing,
 * so the screens build today and wire themselves up as soon as the module appears.
 */
import type { CarePlan, Child, ChildState, CountryCode, Mother, Worker } from '../../types';
import { COUNTRIES } from '../../data';
import { IMMUNISATION_SCHEDULES } from '../../clinical';
import { useSetup } from '../../setup';
import { addDays, daysBetween } from '../format';

type Mod = Record<string, unknown>;
const first = (mods: Record<string, unknown>): Mod | undefined => Object.values(mods)[0] as Mod | undefined;

import * as AUTH_MOD from '../../auth';
import { emergencyNumberFor, LEGAL_TEXT, renderLegal } from '../../legal';
export { emergencyNumberFor };
import { PLAN_TEXT } from '../../clinical';
import { registerTemplates } from '../../i18n';

const AUTH = AUTH_MOD as unknown as Mod;

// PLAN_TEXT (how-to steps, alternatives) and LEGAL_TEXT (disclaimer) render in her language.
for (const [src, table] of [
  ['plan', PLAN_TEXT],
  ['legal', LEGAL_TEXT],
] as const) {
  try {
    registerTemplates(src, table as Record<string, string>);
  } catch {
    /* already registered */
  }
}
import * as CLINICAL_MOD from '../../clinical';
const GUIDES_MOD = CLINICAL_MOD as unknown as Mod;
const VISITS_SUMMARY = first(import.meta.glob('../../visits/summary.ts', { eager: true }));
/** EPDS in plain words (Visits v2): `{ ask, standard, opts, standardOpts }[]`, when the visits module has it. */
export function epdsPlain(): Array<{ ask: string; standard: string; opts: Array<[string, number]>; standardOpts?: Array<[string, number]> }> | undefined {
  const v = (VISITS_INDEX?.EPDS_PLAIN ?? VISITS_EPDS?.EPDS_PLAIN) as unknown;
  return Array.isArray(v) && v.length === 10 ? (v as never) : undefined;
}
const VISITS_EPDS = first(import.meta.glob('../../visits/epds.ts', { eager: true }));
const VISITS_INDEX = first(import.meta.glob('../../visits/index.ts', { eager: true }));

// ---------- Permissions ----------

/** Actions the patient screens check. Unknown actions are allowed until src/auth says otherwise. */
export type PatientAction = 'plan.edit' | 'plan.propose' | 'visit.record' | 'record.edit' | 'message.send' | 'alert.ack' | 'mother.edit';

/** Our patient-screen actions in terms of src/auth's Action set. */
const AUTH_ACTION: Record<PatientAction, string> = {
  'plan.edit': 'edit_plan',
  'plan.propose': 'edit_plan',
  'visit.record': 'edit_plan',
  'record.edit': 'edit_plan',
  'message.send': 'view_own_caseload',
  'alert.ack': 'view_own_caseload',
  'mother.edit': 'edit_plan',
};

export function can(worker: (Worker & { role?: unknown; active?: boolean }) | undefined, action: PatientAction): boolean {
  const fn = AUTH?.can as ((w: unknown, a: string) => boolean) | undefined;
  if (typeof fn !== 'function' || !worker) return true;
  try {
    // A seed Worker has a clinical role but no auth role; convert it the way src/auth does.
    const toProfile = AUTH?.profileFromWorker as ((w: Worker) => unknown) | undefined;
    const profile = typeof worker.role === 'string' && 'active' in worker ? worker : typeof toProfile === 'function' ? toProfile(worker) : worker;
    return fn(profile, AUTH_ACTION[action]) !== false;
  } catch {
    return true;
  }
}

// ---------- Personal mode and legal text ----------

export function usePersonalMode(): boolean {
  const saved = useSetup();
  const role = (saved?.answers as { role?: string } | undefined)?.role;
  return role === 'personal' || role === 'mother';
}

export interface LegalInfo {
  disclaimer: string;
  emergencyNumber: string;
  emergencyLabel: string;
}

export function legalFor(country: CountryCode): LegalInfo {
  const number = emergencyShort(country);
  let disclaimer = DEFAULT_DISCLAIMER;
  try {
    disclaimer = `${renderLegal('legal.disclaimer.not_doctor')} ${renderLegal('legal.disclaimer.emergency', { number })}`;
  } catch {
    /* default */
  }
  return { disclaimer, emergencyNumber: number, emergencyLabel: 'Emergency' };
}

/** The disclaimer keys and params, for rendering in her language. */
export const DISCLAIMER_LINES = ['legal.disclaimer.not_doctor', 'legal.disclaimer.emergency'] as const;

const DEFAULT_DISCLAIMER = 'Gaskin helps you plan. It does not replace a health worker.';

/** The verified national emergency number (src/legal), else the first number in the country line. */
export function emergencyShort(country: CountryCode): string {
  try {
    const n = emergencyNumberFor(country);
    const first = n?.match(/\d{2,5}/)?.[0];
    if (first) return first;
  } catch {
    /* fall back */
  }
  const line = COUNTRIES[country]?.emergencyLine ?? '112';
  return line.match(/\d{2,4}/)?.[0] ?? '112';
}

// ---------- Guides ----------

export interface Guide {
  id: string;
  title: string;
  summary?: string;
  /** For health workers: how to run it */
  forWorker?: { steps: string[]; notes?: string[] };
  /** In personal mode: where to get help */
  forMother?: { text: string; where?: string[] };
  /** Phone numbers per country */
  numbers?: Partial<Record<CountryCode, Array<{ label: string; number: string }>>>;
  sources?: Array<{ id: string; label: string; url?: string }>;
  /** Where to get help, per country code or 'default' */
  whereByCountry?: Partial<Record<string, string[]>>;
}

export function getGuide(id: string | undefined): Guide | undefined {
  if (!id || !GUIDES_MOD) return undefined;
  const table = (GUIDES_MOD.GUIDES ?? GUIDES_MOD.default) as Record<string, unknown> | Array<unknown> | undefined;
  if (!table) return undefined;
  const raw = (Array.isArray(table) ? table.find((g) => (g as { id?: string }).id === id) : table[id]) as Record<string, unknown> | undefined;
  if (!raw) return undefined;
  return normaliseGuide(id, raw);
}

/**
 * Accept the GUIDES shape from CONTRACTS.md (`forWorker: { summary; steps?; sessions? }`,
 * `forMother: { summary; steps }`, `whereToGetHelp: { [country|'default']: { name; contact?; note }[] }`)
 * and tolerate older or looser shapes, since the sheet only needs text.
 */
function normaliseGuide(id: string, g: Record<string, unknown>): Guide {
  const txt = (s: unknown): string => (typeof s === 'string' ? s : s && typeof s === 'object' ? String((s as { text?: string; title?: string; summary?: string }).text ?? (s as { title?: string }).title ?? (s as { summary?: string }).summary ?? '') : '');
  const arr = (x: unknown): string[] => (Array.isArray(x) ? x.map(txt).filter(Boolean) : typeof x === 'string' ? [x] : []);
  const w = (g.forWorker ?? g.worker) as Record<string, unknown> | undefined;
  const m = (g.forMother ?? g.mother) as Record<string, unknown> | string | undefined;
  const help = (g.whereToGetHelp ?? g.numbers ?? g.helplines) as Record<string, Array<{ name?: string; label?: string; contact?: string; number?: string; note?: string }>> | undefined;
  const numbers: Guide['numbers'] = {};
  const where: Partial<Record<string, string[]>> = {};
  if (help) {
    for (const [k, list] of Object.entries(help)) {
      if (!Array.isArray(list)) continue;
      (numbers as Record<string, Array<{ label: string; number: string }>>)[k] = list.filter((x) => x.contact ?? x.number).map((x) => ({ label: [x.name ?? x.label ?? '', x.note].filter(Boolean).join(': '), number: String(x.contact ?? x.number) }));
      where[k] = list.map((x) => [x.name ?? x.label, x.note].filter(Boolean).join(': ')).filter(Boolean);
    }
  }
  const sessions = arr(w?.sessions);
  return {
    id,
    title: String(g.title ?? g.name ?? id),
    summary: txt(g.summary) || (w ? txt(w.summary) : '') || undefined,
    forWorker: w ? { steps: [...arr(w.steps ?? w.howTo), ...sessions], notes: arr(w.notes ?? w.tips) } : undefined,
    forMother: m ? (typeof m === 'string' ? { text: m } : { text: txt(m.summary ?? m.text), where: arr(m.steps) }) : undefined,
    numbers,
    whereByCountry: where,
    sources: (g.sources as Guide['sources']) ?? [],
  };
}

/** Find a guide named in a line of text, e.g. "Weekly Thinking Healthy support". */
export function guideIdFor(text: string): string | undefined {
  if (!GUIDES_MOD) return undefined;
  const table = (GUIDES_MOD.GUIDES ?? GUIDES_MOD.default) as Record<string, { title?: string; name?: string; aliases?: string[] }> | undefined;
  if (!table || Array.isArray(table)) return undefined;
  const t = text.toLowerCase();
  for (const [id, g] of Object.entries(table)) {
    const names = [g.title, g.name, ...(g.aliases ?? [])].filter(Boolean).map((s) => String(s).toLowerCase());
    if (names.some((n) => n.length > 5 && t.includes(n))) return id;
  }
  return undefined;
}

// ---------- Visit summary ----------

export function summariseFn(): ((...a: unknown[]) => unknown) | undefined {
  const fn = VISITS_SUMMARY?.summariseChecklist ?? VISITS_INDEX?.summariseChecklist;
  return typeof fn === 'function' ? (fn as (...a: unknown[]) => unknown) : undefined;
}

export function visitsExport<T>(name: string): T | undefined {
  return (VISITS_INDEX?.[name] as T | undefined) ?? (VISITS_SUMMARY?.[name] as T | undefined);
}

// ---------- Children ----------

/** Every child under 1,000 days (plus any older sibling with the same mother is ignored), youngest last. */
export function childrenOf(mother: Mother, plan: CarePlan, clock: string): ChildState[] {
  const fromEngine = plan.state.children;
  if (fromEngine?.length) return fromEngine;
  const kids = mother.children.filter((c) => daysBetween(c.dob, clock) >= 0 && daysBetween(c.dob, clock) <= 730 + 30);
  const sorted = [...kids].sort((a, b) => (a.dob < b.dob ? -1 : 1));
  return sorted.map((c) => fallbackChildState(mother, c, clock, sorted));
}

function fallbackChildState(mother: Mother, c: Child, clock: string, all: Child[]): ChildState {
  const ageDays = daysBetween(c.dob, clock);
  const mine = (e: { childId?: string }) => e.childId === c.id || (!e.childId && all.length === 1);
  const growth = mother.events.filter((e) => e.kind === 'growth' && mine(e) && e.weightKg).sort((a, b) => (a.at < b.at ? -1 : 1));
  const last = growth[growth.length - 1] as { weightKg?: number; at: string } | undefined;
  const given = new Set(mother.events.filter((e) => e.kind === 'immunisation' && mine(e)).flatMap((e) => (e.kind === 'immunisation' ? e.vaccines : [])));
  const sched = IMMUNISATION_SCHEDULES[mother.country] ?? [];
  const nextRow = sched.find((s) => s.vaccines.some((v) => !given.has(v)));
  const overdue = sched.filter((s) => s.ageDays + 28 < ageDays).flatMap((s) => s.vaccines.filter((v) => !given.has(v)));
  const corrected = c.gestationAtBirthWeeks < 37 ? ageDays - (40 - c.gestationAtBirthWeeks) * 7 : undefined;
  return {
    childId: c.id,
    name: c.name,
    sex: c.sex,
    dob: c.dob,
    ageDays,
    correctedAgeDays: corrected,
    feeding: c.feeding,
    twin: all.some((o) => o.id !== c.id && o.dob.slice(0, 10) === c.dob.slice(0, 10)),
    latestWeightKg: last?.weightKg ?? c.birthWeightKg,
    latestWeightAt: last?.at ?? c.dob,
    immunisation: {
      next: nextRow
        ? { label: nextRow.label, due: addDays(c.dob, nextRow.ageDays), missing: nextRow.vaccines.filter((v) => !given.has(v)), overdueDays: Math.max(0, ageDays - nextRow.ageDays) }
        : undefined,
      overdue,
    },
    risks: [],
  };
}
