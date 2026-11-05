/**
 * Gaskin privacy layer: de-identify everything before it leaves the device.
 *
 * What this does: names become [MOTHER], [BABY], [CARER], [WORKER],
 * [DOCTOR]; phone numbers, emails, Gaskin and hospital IDs and addresses are
 * removed; community and facility names become [COMMUNITY] / [FACILITY];
 * exact age becomes a five-year band (with "adolescent (under 18)" kept
 * because it changes care); absolute dates become relative terms
 * (gestational week, days after birth, baby's age, "3 weeks ago");
 * location is generalised to country and zone.
 *
 * What this does not do: guarantee anonymity. The result is pseudonymised
 * data. Under Nigeria's NDPA 2023 (and Kenya's DPA 2019, Ghana's DPA 2012)
 * pseudonymised data is still personal data when it can be re-identified,
 * for instance by someone who also holds the clinic register. So a mother's
 * consent to AI processing and a data processing agreement with any cloud
 * AI provider are still required. The no-AI (templates) and on-device modes
 * avoid any transfer at all.
 */
import type { CarePlan, Mother } from '../types';
import { buildSafeContext, collectTerms, asOfFor, getPrivacyDirectory, type SafeContext, type SafeContextOptions } from './context';
import { findLeaks, scrubText, type PrivacyCategory, type ScrubTerm } from './scrub';

export { scrubText, findLeaks, ageBand, relativeDate, termRegex } from './scrub';
export type { PrivacyCategory, Placeholder, ScrubTerm, ScrubResult } from './scrub';
export { buildSafeContext, collectTerms, setPrivacyDirectory, getPrivacyDirectory, rememberMother, stageText, asOfFor } from './context';
export type { SafeContext, SafeItem, SafeAlert, PrivacyDirectory, SafeContextOptions } from './context';
export { recordAICall, getAIAuditLog, clearAIAuditLog, byteLength } from './audit';
export type { AIAuditEntry } from './audit';
export { zoneFor, COUNTRY_NAMES } from './zones';

/** Placeholder -> local value, kept on the device to restore names in replies */
export type ReidentifyMap = Partial<Record<'[MOTHER]' | '[BABY]' | '[WORKER]' | '[FACILITY]' | '[COMMUNITY]' | '[EMERGENCY_LINE]', string>>;

export type DeidentifyInput =
  | {
      /** Free text such as a doctor's report */
      text: string;
      mother?: Mother;
      plan?: CarePlan;
      asOf?: string;
      workerName?: string;
      facilityName?: string;
      emergencyLine?: string;
    }
  | ({
      plan: CarePlan;
      mother: Mother;
      emergencyLine?: string;
    } & SafeContextOptions);

export interface DeidentifyResult {
  /** Scrubbed text, when the input was text */
  text?: string;
  /** De-identified structured context, when the input was a plan and mother */
  payload?: SafeContext;
  map: ReidentifyMap;
  /** Categories of identifiers that were found and removed */
  removed: PrivacyCategory[];
  /** Known identifiers that were checked for; use with findLeaks before sending */
  terms: ScrubTerm[];
}

function first(name: string | undefined): string | undefined {
  const f = (name ?? '').trim().split(/\s+/)[0];
  return f || undefined;
}

export function buildReidentifyMap(
  mother: Mother | undefined,
  opts: { workerName?: string; facilityName?: string; emergencyLine?: string } = {},
): ReidentifyMap {
  const map: ReidentifyMap = {};
  const dir = getPrivacyDirectory();
  if (mother) {
    map['[MOTHER]'] = first(mother.name);
    const baby = mother.children?.[mother.children.length - 1];
    if (baby) map['[BABY]'] = first(baby.name);
    if (mother.community) map['[COMMUNITY]'] = mother.community;
  }
  const worker = opts.workerName ?? (mother ? dir.workers?.find((w) => w.id === mother.assignedWorkerId)?.name : undefined);
  const facility = opts.facilityName ?? (mother ? dir.facilities?.find((f) => f.id === mother.facilityId)?.name : undefined);
  if (worker) map['[WORKER]'] = first(worker.replace(/^(?:Dr|Mrs|Mr|Ms|Nurse|Sister)\.?\s+/i, ''));
  if (facility) map['[FACILITY]'] = facility;
  if (opts.emergencyLine) map['[EMERGENCY_LINE]'] = opts.emergencyLine;
  return map;
}

/** De-identify free text or a plan + mother before anything is sent to an AI */
export function deidentify(input: DeidentifyInput): DeidentifyResult {
  if ('text' in input && typeof input.text === 'string') {
    const terms = collectTerms(input.mother, { workerName: input.workerName, facilityName: input.facilityName });
    const r = scrubText(input.text, terms, { asOf: input.asOf ?? asOfFor(input.plan) });
    return {
      text: r.text,
      map: buildReidentifyMap(input.mother, input),
      removed: r.removed,
      terms,
    };
  }
  const { plan, mother, ...opts } = input as { plan: CarePlan; mother: Mother; emergencyLine?: string } & SafeContextOptions;
  const payload = buildSafeContext(plan, mother, opts);
  return {
    payload,
    map: buildReidentifyMap(mother, opts),
    removed: payload.removed,
    terms: collectTerms(mother, opts),
  };
}

/**
 * Restore names locally after the AI replies. Only the first name is put
 * back for [MOTHER] and [BABY]; [WORKER] and [FACILITY] restore the
 * sign-off. Placeholders with no local value are left for the worker to see.
 */
export function reidentify(text: string, map: ReidentifyMap): string {
  let out = text;
  for (const [ph, val] of Object.entries(map)) {
    if (!val) continue;
    const inner = ph.slice(1, -1);
    // Models sometimes drop the brackets' spacing or case: [Mother], [ MOTHER ]
    out = out.replace(new RegExp(String.raw`\[\s*${inner}\s*\]`, 'gi'), val);
  }
  return out;
}

/** Does this outbound text still contain anything we know identifies her? */
export function checkOutbound(text: string, terms: ScrubTerm[]): { ok: boolean; leaks: PrivacyCategory[] } {
  const leaks = findLeaks(text, terms);
  return { ok: leaks.length === 0, leaks };
}

// ---------- "What the AI sees" ----------

export type PreviewTask = 'personalise' | 'translate' | 'explain' | 'suggest' | 'extract';

export interface AIPreview {
  /** Exactly the prompt that would leave the device */
  text: string;
  /** Categories of identifiers removed */
  removed: string[];
  /** Categories of data included */
  categories: string[];
  /** Provider and mode that would receive it */
  provider: string;
  mode: string;
  /** False when AI is off (templates): nothing leaves the device */
  wouldSend: boolean;
  bytes: number;
}

type PreviewBuilder = (task: PreviewTask, args: Record<string, unknown>) => AIPreview;
let previewBuilder: PreviewBuilder | null = null;

/** The AI layer registers its prompt builder here so the preview is byte-identical to what is sent */
export function registerPreviewBuilder(fn: PreviewBuilder): void {
  previewBuilder = fn;
}

/**
 * Exactly what would be sent for this task with the current AI settings.
 * args: { plan, mother, channel?, language?, itemIds?, maxChars?, texts?, text?, workerName?, facilityName? }
 */
export function previewForAI(task: PreviewTask, args: Record<string, unknown>): AIPreview {
  if (previewBuilder) return previewBuilder(task, args);
  // AI layer not loaded: show the de-identified context only
  const plan = args.plan as CarePlan | undefined;
  const mother = args.mother as Mother | undefined;
  let text = '';
  let removed: string[] = [];
  if (typeof args.text === 'string') {
    const r = deidentify({ text: args.text, mother, plan });
    text = r.text ?? '';
    removed = r.removed;
  } else if (plan && mother) {
    const r = deidentify({ plan, mother, itemIds: args.itemIds as string[] | undefined });
    const { keyToId: _k, ...visible } = r.payload!;
    void _k;
    text = JSON.stringify(visible, null, 2);
    removed = r.removed;
  }
  return { text, removed, categories: [], provider: 'none', mode: 'none', wouldSend: false, bytes: 0 };
}
