/**
 * One pipeline for every live provider:
 *   build a de-identified prompt -> leak check -> send through a transport
 *   -> re-identify locally -> guardrails -> template fallback on failure.
 * Providers differ only in their transport (how a prompt reaches a model).
 *
 * Constrained transports (on-device models, copy-and-paste into a free AI
 * app) only run tasks that rewrite fixed text or extract fields:
 * personalise, translate, extract. Explanations and suggestions come from
 * the templates there, and any output that fails validation is replaced by
 * the template result.
 */
import type { CarePlan, ExtractedFinding, LanguageCode, Mother } from '../types';
import {
  buildReidentifyMap,
  byteLength,
  checkOutbound,
  collectTerms,
  deidentify,
  facilityNamesIn,
  getPrivacyDirectory,
  otherFacilitiesIn,
  recordAICall,
  reidentify,
  rememberMother,
  scrubText,
  type AIAuditEntry,
  type ReidentifyMap,
  type ScrubTerm,
} from '../privacy';
import { cleanMessage, DEFAULT_MAX_CHARS, parseJsonLoose, selectItems } from './context';
import { findMedicines } from './lexicon';
import { filterSuggestions, findDoses, validateAIText } from './guardrails';
import {
  explainPrompt,
  extractPrompt,
  extractPromptCompact,
  personalisePrompt,
  personalisePromptCompact,
  suggestPrompt,
  translatePrompt,
  translatePromptCompact,
} from './prompts';
import { setAIStatus } from './status';
import { composeTemplateMessage, templateExplain, templateProvider, templateTranslate } from './providers/template';
import { EXTRACTION_FIELDS, type AIProvider, type ExplainArgs, type ExtractArgs, type PersonaliseArgs, type SuggestArgs, type SuggestedItem, type TranslateArgs } from './types';

export type AITask = 'personalise' | 'translate' | 'extract' | 'explain' | 'suggest';
export type AIMode = 'auto' | 'none' | 'claude_here' | 'own_key' | 'on_device' | 'any_app';

export interface TransportCallOpts {
  task: AITask;
  /** The reply must be JSON */
  json: boolean;
  tier: 'quick' | 'default';
  signal?: AbortSignal;
  onText?: (t: string) => void;
}

export interface Transport {
  id: string;
  label: string;
  mode: AIMode;
  destination: AIAuditEntry['destination'];
  /** Use the short prompts (small models, copy and paste) */
  compact: boolean;
  /** Only personalise / translate / extract; template for the rest; fall back when validation fails */
  constrained: boolean;
  /** De-identify prompts before sending (always true except on-device when switched off) */
  deidentify: boolean;
  complete(prompt: string, o: TransportCallOpts): Promise<string>;
}

/** A failure the transport understands. permanent: stop using this transport for the session. */
export class TransportError extends Error {
  permanent: boolean;
  code?: string;
  constructor(message: string, permanent = false, code?: string) {
    super(message);
    this.name = 'TransportError';
    this.permanent = permanent;
    this.code = code;
  }
}

export function abortError(): Error {
  try {
    return new DOMException('The AI request was cancelled.', 'AbortError');
  } catch {
    const e = new Error('The AI request was cancelled.');
    e.name = 'AbortError';
    return e;
  }
}

function isAbort(e: unknown): boolean {
  return (e as { name?: string })?.name === 'AbortError' || (e as { code?: string })?.code === 'cancelled';
}

// ---------- Prompt building (shared with "What the AI sees") ----------

export interface BuiltPrompt {
  prompt: string;
  terms: ScrubTerm[];
  map: ReidentifyMap;
  categories: string[];
  removed: string[];
  /** Alias -> real key (translation) */
  keyMap?: Record<string, string>;
  /** Source text after aliasing (translation), for per-key checks */
  sources?: Record<string, string>;
}

export interface PromptArgs {
  plan?: CarePlan;
  mother?: Mother;
  channel?: PersonaliseArgs['channel'];
  language?: LanguageCode;
  itemIds?: string[];
  maxChars?: number;
  texts?: Record<string, string>;
  text?: string;
  workerName?: string;
  facilityName?: string;
  emergencyLine?: string;
}

function withDefaults(map: ReidentifyMap): ReidentifyMap {
  return { '[WORKER]': 'your health worker', '[FACILITY]': 'your clinic', '[COMMUNITY]': 'your community', ...map };
}

/**
 * The one other facility the source text names (her referral hospital), so the reply can say it.
 * With none or several, [OTHER_FACILITY] stays a placeholder and the guardrails send the template instead.
 */
function otherFacility(sourceText: string, mother: Mother | undefined, facilityName: string | undefined): string | undefined {
  const own = facilityName ?? getPrivacyDirectory().facilities?.find((f) => f.id === mother?.facilityId)?.name;
  // Known facilities by their exact name first; the shape-based finder only when none is known
  const known = otherFacilitiesIn(sourceText, mother).filter((n) => n !== own);
  if (known.length) return known.length === 1 ? known[0] : undefined;
  const found = facilityNamesIn(sourceText, own ? [own] : []);
  return found.length === 1 ? found[0] : undefined;
}

function planSourceText(plan: CarePlan, itemIds?: string[]): string {
  const want = itemIds?.length ? new Set(itemIds) : null;
  const items = plan.items.filter((i) => i.status === 'active' && (!want || want.has(i.id)));
  return [...items.map((i) => `${i.title}\n${i.motherText}\n${i.detail}`), ...plan.alerts.map((a) => `${a.title}\n${a.action}\n${a.reason}`), plan.nextContact?.label ?? ''].join('\n');
}

function relink(prompt: string, t: Pick<Transport, 'deidentify'>, map: ReidentifyMap): string {
  // On-device with de-identification switched off: put the real values back before sending
  return t.deidentify ? prompt : reidentify(prompt, map);
}

export function buildPrompt(task: AITask, a: PromptArgs, t: Pick<Transport, 'compact' | 'deidentify'>): BuiltPrompt {
  const mother = a.mother;
  rememberMother(mother);
  const plan = a.plan;
  switch (task) {
    case 'personalise': {
      if (!plan || !mother) throw new Error('personalise needs a plan and a mother');
      const channel = a.channel ?? 'sms';
      const language = a.language ?? mother.language;
      const ids = selectItems(plan, a.itemIds).map((i) => i.id);
      const d = deidentify({ plan, mother, itemIds: ids, workerName: a.workerName, facilityName: a.facilityName, emergencyLine: a.emergencyLine });
      const ctx = d.payload!;
      const maxChars = a.maxChars ?? DEFAULT_MAX_CHARS[channel];
      const names = (d.map['[MOTHER]']?.length ?? 0) + (d.map['[WORKER]']?.length ?? 0) + (d.map['[FACILITY]']?.length ?? 0);
      const opts = {
        language,
        channel,
        maxChars: Math.max(80, maxChars - Math.max(0, names - 30)),
        hasEmergencyLine: Boolean(a.emergencyLine),
        hasWorker: Boolean(d.map['[WORKER]']),
      };
      const prompt = t.compact ? personalisePromptCompact(ctx, opts) : personalisePrompt(ctx, opts);
      const other = otherFacility(planSourceText(plan, ids), mother, a.facilityName);
      const map = withDefaults(other ? { ...d.map, '[OTHER_FACILITY]': other } : d.map);
      return { prompt: relink(prompt, t, map), terms: d.terms, map, categories: ctx.categories, removed: ctx.removed };
    }
    case 'translate': {
      const texts = a.texts ?? {};
      const terms = collectTerms(mother, { workerName: a.workerName, facilityName: a.facilityName });
      const removed = new Set<string>();
      const keyMap: Record<string, string> = {};
      const sources: Record<string, string> = {};
      Object.entries(texts).forEach(([k, v], n) => {
        const alias = `t${n + 1}`;
        keyMap[alias] = k;
        const r = scrubText(v, terms, { asOf: plan?.state?.asOf });
        r.removed.forEach((c) => removed.add(c));
        sources[alias] = r.text;
      });
      const language = a.language ?? 'en';
      const prompt = t.compact ? translatePromptCompact(sources, language) : translatePrompt(sources, language, a.channel);
      const map = buildReidentifyMap(mother, { ...a, otherFacility: otherFacility(Object.values(texts).join('\n'), mother, a.facilityName) });
      return { prompt: relink(prompt, t, map), terms, map: withDefaults(map), categories: ['plan item text'], removed: [...removed], keyMap, sources };
    }
    case 'extract': {
      const d = deidentify({ text: a.text ?? '', mother, plan, workerName: a.workerName, facilityName: a.facilityName });
      const prompt = t.compact ? extractPromptCompact(d.text ?? '') : extractPrompt(d.text ?? '');
      const other = otherFacility(a.text ?? '', mother, a.facilityName);
      const map = other ? { ...d.map, '[OTHER_FACILITY]': other } : d.map;
      return { prompt: relink(prompt, t, map), terms: d.terms, map, categories: ['clinical report text (scrubbed)'], removed: d.removed };
    }
    case 'explain':
    case 'suggest': {
      if (!plan || !mother) throw new Error(`${task} needs a plan and a mother`);
      const d = deidentify({ plan, mother, includeDetail: true, workerName: a.workerName, facilityName: a.facilityName });
      const ctx = d.payload!;
      const prompt = task === 'explain' ? explainPrompt(ctx) : suggestPrompt(ctx);
      const other = otherFacility(planSourceText(plan), mother, a.facilityName);
      const map = withDefaults(other ? { ...d.map, '[OTHER_FACILITY]': other } : d.map);
      return { prompt: relink(prompt, t, map), terms: d.terms, map, categories: ctx.categories, removed: ctx.removed };
    }
  }
}

// ---------- Output checks ----------

const CONFS = new Set(['high', 'medium', 'low']);
const FIELDS = new Set<string>(EXTRACTION_FIELDS);

function numbersIn(s: string): Set<string> {
  return new Set((s.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(parseFloat(n))));
}

/** Keep only well-formed findings that are grounded in the report text */
export function normaliseFindings(raw: unknown, source: string): ExtractedFinding[] {
  if (!Array.isArray(raw)) {
    const o = raw as Record<string, unknown> | null;
    if (o && Array.isArray(o.findings)) raw = o.findings;
    else return [];
  }
  const srcNums = numbersIn(source);
  const srcMeds = new Set(findMedicines(source).map((m) => m.generic));
  const out: ExtractedFinding[] = [];
  for (const r of raw as unknown[]) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const field = String(o.field ?? '').trim().toLowerCase();
    const value = o.value == null ? '' : String(o.value).trim();
    let confidence = String(o.confidence ?? 'medium').toLowerCase() as ExtractedFinding['confidence'];
    if (!FIELDS.has(field) || !value) continue;
    if (!CONFS.has(confidence)) confidence = 'medium';
    // Grounding: numbers must come from the report (Hb estimated from PCV is checked via the PCV figure)
    const nums = [...numbersIn(value)];
    if (['systolic', 'diastolic', 'temperature', 'weight', 'gestational_weeks'].includes(field) && nums.length && !srcNums.has(nums[0])) continue;
    if (field === 'haemoglobin' && nums.length && !nums.some((n) => srcNums.has(n))) continue;
    // Medicines must be named in the report
    if (field === 'medication') {
      const meds = findMedicines(value).map((m) => m.generic);
      if (meds.length && !meds.some((m) => srcMeds.has(m))) continue;
      const doses = findDoses(value).map((d) => d.key);
      const srcDoses = new Set(findDoses(source).map((d) => d.key));
      if (doses.some((d) => !srcDoses.has(d))) confidence = 'low';
    }
    if (out.some((f) => f.field === field && f.value.toLowerCase() === value.toLowerCase())) continue;
    out.push({ field, value, confidence });
  }
  return out;
}

/** Problems with one translated string, compared with its English source */
export function translationIssues(source: string, translated: string): string[] {
  const issues: string[] = [];
  if (!translated.trim()) return ['empty'];
  const srcMeds = new Set(findMedicines(source).map((m) => m.generic));
  for (const m of findMedicines(translated)) if (!srcMeds.has(m.generic)) issues.push(`adds medicine ${m.matched}`);
  const srcDoses = new Set(findDoses(source).map((d) => d.key));
  for (const d of findDoses(translated)) if (!srcDoses.has(d.key)) issues.push(`adds dose ${d.text}`);
  const outNums = numbersIn(translated);
  for (const n of numbersIn(source)) if (!outNums.has(n)) issues.push(`drops the number ${n}`);
  return issues;
}

// ---------- Live provider ----------

export interface LiveProviderOptions {
  /** Called when the transport fails permanently, so the selector can forget it */
  onPermanentFailure?: (reason: string) => void;
}

const CONSTRAINED_TASKS: AITask[] = ['personalise', 'translate', 'extract'];

function describeError(e: unknown): string {
  let msg: string;
  if (e instanceof TransportError) msg = e.message;
  else {
    const o = e as { code?: string; message?: string };
    msg = o?.code && o?.message ? `${o.code}: ${o.message}` : (o?.message ?? String(e));
  }
  // Error text reaches the status line and the audit log: never with a key in it
  return msg.replace(/\b(?:sk|pk|rk|gsk|xai|AIza)[-_A-Za-z0-9]{12,}\b/g, '[key hidden]').replace(/Bearer\s+[-._~+/A-Za-z0-9]{12,}=*/gi, 'Bearer [key hidden]');
}

export function makeLiveProvider(t: Transport, lo: LiveProviderOptions = {}): AIProvider & { transport: Transport; disabledReason?: string } {
  let disabled: string | undefined;

  const statusOk = () => setAIStatus({ provider: t.id, label: t.label, live: true, mode: t.mode, lastError: undefined, lastFallbackOp: undefined });

  function fail(task: AITask, e: unknown, built?: BuiltPrompt, outcome: AIAuditEntry['outcome'] = 'error') {
    const msg = describeError(e);
    const permanent = e instanceof TransportError && e.permanent;
    if (permanent) {
      disabled = msg;
      provider.disabledReason = msg;
      lo.onPermanentFailure?.(msg);
    }
    recordAICall({
      provider: t.id,
      mode: t.mode,
      task,
      categories: built?.categories ?? [],
      removed: built?.removed ?? [],
      bytes: outcome === 'blocked' ? 0 : built ? byteLength(built.prompt) : 0,
      destination: t.destination,
      deidentified: t.deidentify,
      outcome,
      note: msg.slice(0, 200),
    });
    setAIStatus({
      provider: permanent ? 'template' : t.id,
      label: permanent ? 'Offline templates' : t.label,
      live: !permanent,
      mode: t.mode,
      lastError: msg,
      lastFallbackOp: task,
    });
  }

  /** Run a task through the transport. Returns undefined when the caller should use the template. Rethrows aborts. */
  async function run(task: AITask, args: PromptArgs, o: { json: boolean; tier: 'quick' | 'default'; signal?: AbortSignal; onText?: (t: string) => void }): Promise<{ text: string; built: BuiltPrompt } | undefined> {
    if (o.signal?.aborted) throw abortError();
    if (disabled) {
      setAIStatus({ provider: 'template', label: 'Offline templates', live: false, mode: t.mode, lastError: disabled, lastFallbackOp: task });
      return undefined;
    }
    if (t.constrained && !CONSTRAINED_TASKS.includes(task)) return undefined;
    let built: BuiltPrompt;
    try {
      built = buildPrompt(task, args, t);
    } catch (e) {
      fail(task, e);
      return undefined;
    }
    if (t.deidentify) {
      const leak = checkOutbound(built.prompt, built.terms);
      if (!leak.ok) {
        fail(task, new Error(`Not sent: the prompt still contained ${leak.leaks.join(', ')} after de-identification.`), built, 'blocked');
        return undefined;
      }
    }
    try {
      const raw = await t.complete(built.prompt, {
        task,
        json: o.json,
        tier: o.tier,
        signal: o.signal,
        onText: o.onText ? (x) => o.onText!(reidentify(x, built.map)) : undefined,
      });
      recordAICall({
        provider: t.id,
        mode: t.mode,
        task,
        categories: built.categories,
        removed: built.removed,
        bytes: byteLength(built.prompt),
        destination: t.destination,
        deidentified: t.deidentify,
        outcome: 'sent',
      });
      statusOk();
      return { text: raw, built };
    } catch (e) {
      if (isAbort(e) || o.signal?.aborted) throw abortError();
      fail(task, e, built);
      return undefined;
    }
  }

  function guardFail(task: AITask, why: string) {
    setAIStatus({ provider: t.id, label: t.label, live: true, mode: t.mode, lastError: `The AI reply was replaced by the template: ${why}`, lastFallbackOp: task });
  }

  const provider: AIProvider & { transport: Transport; disabledReason?: string } = {
    id: t.id,
    label: t.label,
    live: true,
    transport: t,

    async personaliseMessage(a: PersonaliseArgs) {
      const fallback = () => templateProvider.personaliseMessage({ ...a, signal: undefined });
      const r = await run('personalise', a, { json: false, tier: 'default', signal: a.signal, onText: a.onText });
      if (!r) return fallback();
      const text = reidentify(cleanMessage(r.text), r.built.map);
      // Every transport, not only the small ones: a capable model can still be talked into
      // reassurance or a new medicine by text inside the plan, so the same checks apply.
      const v = validateAIText(text, a.plan, a.mother);
      if (!v.ok) {
        guardFail('personalise', v.issues[0]);
        return fallback();
      }
      return text;
    },

    async translate(a: TranslateArgs) {
      const fallback = () => templateTranslate(a.texts, a.language);
      if (a.language === 'en') return { ...a.texts };
      if (!Object.keys(a.texts).length) return {};
      const r = await run('translate', a, { json: true, tier: 'quick', signal: a.signal });
      if (!r) return fallback();
      let parsed: Record<string, unknown>;
      try {
        parsed = parseJsonLoose<Record<string, unknown>>(r.text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      } catch {
        guardFail('translate', 'the reply was not the JSON object requested.');
        return fallback();
      }
      const out: Record<string, string> = {};
      const tmpl = templateTranslate(a.texts, a.language);
      const problems: string[] = [];
      for (const [alias, key] of Object.entries(r.built.keyMap ?? {})) {
        const v = parsed[alias] ?? parsed[key];
        const s = typeof v === 'string' ? v.trim() : '';
        const issues = s ? translationIssues(r.built.sources?.[alias] ?? a.texts[key], s) : ['missing'];
        if (issues.length) {
          problems.push(`${key}: ${issues.join(', ')}`);
          out[key] = tmpl[key];
        } else {
          out[key] = reidentify(s, r.built.map);
        }
      }
      if (problems.length) guardFail('translate', `${problems.length} text(s) did not keep medicines, doses or numbers exactly (${problems.slice(0, 2).join('; ')}).`);
      return out;
    },

    async extractFindings(a: ExtractArgs) {
      const fallback = () => templateProvider.extractFindings({ text: a.text });
      if (!a.text?.trim()) return [];
      const r = await run('extract', a, { json: true, tier: 'quick', signal: a.signal });
      if (!r) return fallback();
      try {
        const findings = normaliseFindings(parseJsonLoose(r.text), a.text);
        if (!findings.length && t.constrained) return fallback();
        return findings.map((f) => ({ ...f, value: reidentify(f.value, r.built.map) }));
      } catch {
        guardFail('extract', 'the reply was not the JSON list requested.');
        return fallback();
      }
    },

    async explainPlan(a: ExplainArgs) {
      const fallback = () => {
        const s = templateExplain(a.plan, a.mother);
        a.onText?.(s);
        return s;
      };
      const r = await run('explain', a, { json: false, tier: 'default', signal: a.signal, onText: a.onText });
      if (!r) return fallback();
      const text = reidentify(cleanMessage(r.text), r.built.map);
      // An explanation must not introduce medicines, doses or reassurance the plan does not contain
      const v = validateAIText(text, a.plan, a.mother, { audience: 'worker' });
      if (!v.ok) {
        guardFail('explain', v.issues[0]);
        return fallback();
      }
      return text;
    },

    async suggestItems(a: SuggestArgs): Promise<SuggestedItem[]> {
      const r = await run('suggest', a, { json: true, tier: 'default', signal: a.signal });
      if (!r) return [];
      try {
        const { items, rejected } = filterSuggestions(parseJsonLoose(r.text), a.plan);
        if (rejected.length) guardFail('suggest', rejected[0]);
        return items.map((i) => ({ ...i, title: reidentify(i.title, r.built.map), detail: reidentify(i.detail, r.built.map), motherText: reidentify(i.motherText, r.built.map) }));
      } catch {
        guardFail('suggest', 'the reply was not the JSON list requested.');
        return [];
      }
    },
  };
  return provider;
}

/** Template message used by tests and the preview when nothing would be sent */
export { composeTemplateMessage };
