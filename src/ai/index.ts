/**
 * Gaskin AI layer. The deterministic rules engine owns all clinical logic;
 * this layer only words, translates, explains, extracts findings for a
 * worker to confirm, and suggests non-clinical items for a worker to accept.
 * Every output is reviewed by a worker before it reaches a mother.
 *
 * Provider choice (getAIProvider):
 *  - mode 'none'        -> offline templates (a first-class mode)
 *  - mode 'claude_here' -> Claude via the artifact `sample` capability
 *  - mode 'own_key'     -> OpenAI-compatible / Anthropic / Gemini with the worker's key
 *  - mode 'on_device'   -> local server or in-browser WebLLM
 *  - mode 'any_app'     -> copy and paste into any AI app
 *  - mode 'auto'        -> Claude here if available (within 10 s), else the
 *                          build-time OpenAI-compatible server, else templates
 * Every live provider de-identifies prompts (src/privacy), runs guardrails,
 * and falls back to the template result on failure, reporting it through
 * aiStatus / onAIStatus. Nothing falls back silently.
 */
import type { CarePlan, Mother } from '../types';
import { byteLength, registerPreviewBuilder, type AIPreview, type PreviewTask } from '../privacy';
import { buildPrompt, makeLiveProvider, type AITask, type PromptArgs, type Transport } from './pipeline';
import { createClaudeSampleProvider, resolveSample } from './providers/claudeSample';
import { anthropicTransport, geminiTransport, openAICompatibleTransport } from './providers/http';
import { manualTransport } from './providers/manual';
import { onDeviceTransport } from './providers/onDevice';
import { openAICompatibleConfigFromEnv } from './providers/openaiCompatible';
import { templateProvider } from './providers/template';
import { _setSettings, getAISettings, normaliseSettings, type AISettings } from './settings';
import { getAIStatus, setAIStatus } from './status';
import type { AIProvider } from './types';

// ---------- Public types and helpers ----------

export type { AIProvider, AIStatus, PersonaliseArgs, TranslateArgs, ExtractArgs, ExplainArgs, SuggestArgs, SuggestedItem, ExtractionField } from './types';
export { EXTRACTION_FIELDS } from './types';
export type { AISettings, AISettingsMode, ProviderOption } from './settings';
export { PROVIDER_OPTIONS, getAISettings } from './settings';
export { aiStatus, onAIStatus, getAIStatus } from './status';
export { validateAIText, filterSuggestions, findDoses } from './guardrails';
export type { ValidationResult, ValidateOptions } from './guardrails';
export { MEDICINE_LEXICON, findMedicines } from './lexicon';
export { extractFindingsFromText } from './extract';
export { templateProvider, composeTemplateMessage, toPidgin } from './providers/template';
export { createClaudeSampleProvider, resolveSample } from './providers/claudeSample';
export { createOpenAICompatibleProvider, openAICompatibleConfigFromEnv, isOpenAICompatibleConfigured } from './providers/openaiCompatible';
export { createOnDeviceProvider, hasWebGPU, onWebLLMProgress, WEBLLM_MODELS } from './providers/onDevice';
export { createManualProvider, onManualRequest, submitManualReply, cancelManualRequest, getPendingManualRequests } from './providers/manual';
export type { ManualRequest } from './providers/manual';
export { makeLiveProvider } from './pipeline';
export type { Transport } from './pipeline';
export * as prompts from './prompts';
// Privacy layer re-exports for convenience (the UI may import either module)
export { deidentify, reidentify, previewForAI, getAIAuditLog, setPrivacyDirectory } from '../privacy';
export type { AIAuditEntry, AIPreview } from '../privacy';

// ---------- Selection ----------

let cached: Promise<AIProvider> | null = null;
/** Set once a sample lookup has failed permanently in this session */
let sampleUnavailable: string | null = null;

function announce(p: AIProvider, mode: AISettings['mode'], note?: string): AIProvider {
  // In 'none' mode the status provider is 'none' (the UI shows "AI off"); the provider object is still the template provider
  const statusId = p.id === 'template' && mode === 'none' ? 'none' : p.id;
  setAIStatus({ provider: statusId, label: p.id === 'template' ? (mode === 'none' ? 'No AI (offline templates)' : 'Offline templates') : p.label, live: p.live, mode, lastError: note, lastFallbackOp: undefined });
  return p;
}

function forget(reason: string) {
  // A permanent failure (key rejected, Claude not allowed): the next getAIProvider() re-selects
  cached = null;
  if (/Claude/.test(reason)) sampleUnavailable = reason;
}

function transportFor(s: AISettings): Transport | null {
  if (s.mode === 'own_key' && s.ownKey) {
    const k = s.ownKey;
    if (k.kind === 'anthropic') return anthropicTransport({ apiKey: k.apiKey, model: k.model, baseUrl: k.baseUrl });
    if (k.kind === 'gemini') return geminiTransport({ apiKey: k.apiKey, model: k.model, baseUrl: k.baseUrl });
    return openAICompatibleTransport({ baseUrl: k.baseUrl ?? '', model: k.model, apiKey: k.apiKey || undefined, label: `${k.model} (your key)` });
  }
  if (s.mode === 'on_device' && s.onDevice) return onDeviceTransport(s.onDevice);
  if (s.mode === 'any_app') return manualTransport();
  return null;
}

async function select(): Promise<AIProvider> {
  const s = getAISettings();
  if (s.mode === 'none') return announce(templateProvider, 'none');

  if (s.mode === 'claude_here' || s.mode === 'auto') {
    const sample = sampleUnavailable ? null : await resolveSample();
    if (sample) return announce(createClaudeSampleProvider(sample, { onPermanentFailure: forget }), s.mode);
    if (s.mode === 'claude_here') {
      return announce(templateProvider, s.mode, sampleUnavailable ?? 'Claude is only available when this page is opened inside Claude. Using offline templates.');
    }
    const env = openAICompatibleConfigFromEnv();
    if (env) return announce(makeLiveProvider(openAICompatibleTransport({ ...env, label: `${env.model} (organisation server)` }), { onPermanentFailure: forget }), s.mode);
    return announce(templateProvider, s.mode);
  }

  const t = transportFor(s);
  if (!t) return announce(templateProvider, s.mode, 'AI settings are incomplete. Using offline templates.');
  return announce(makeLiveProvider(t, { onPermanentFailure: forget }), s.mode);
}

/** The provider for the current settings. Cached; resolves within about 10 s at most. */
export function getAIProvider(): Promise<AIProvider> {
  if (!cached) {
    cached = select().catch((e) => {
      cached = null;
      return announce(templateProvider, getAISettings().mode, `AI could not start: ${(e as Error)?.message ?? e}`);
    });
  }
  return cached;
}

/** Apply new settings (from the UI's settings screen). Throws a plain-English error if incomplete. */
export function configureAI(s: AISettings): AISettings {
  const n = normaliseSettings(s);
  _setSettings(n);
  cached = null;
  if (n.mode === 'claude_here') sampleUnavailable = null; // let the worker try again explicitly
  void getAIProvider();
  return getAISettings();
}

/** Test helper: forget the cached provider and settings */
export function _resetAI(): void {
  cached = null;
  sampleUnavailable = null;
  _setSettings({ mode: 'auto' });
}

// ---------- "What the AI sees" ----------

function previewTransport(s: AISettings): Pick<Transport, 'compact' | 'deidentify' | 'id' | 'label' | 'mode'> | null {
  if (s.mode === 'none') return null;
  if (s.mode === 'claude_here' || s.mode === 'auto') {
    // Mirror what select() chose last time; before selection, assume Claude here
    const current = getAIStatus().provider;
    if (current === 'template' && s.mode === 'auto' && cached) return null;
    if (current === 'openai-compatible') {
      const env = openAICompatibleConfigFromEnv();
      if (env) return openAICompatibleTransport(env);
    }
    return { id: 'claude-sample', label: 'Claude (in this page)', mode: 'claude_here', compact: false, deidentify: true };
  }
  return transportFor(s);
}

const TASK_ALIASES: Record<string, AITask> = { personalise: 'personalise', translate: 'translate', extract: 'extract', explain: 'explain', suggest: 'suggest' };
const CONSTRAINED: AITask[] = ['personalise', 'translate', 'extract'];

function buildPreview(task: PreviewTask, args: Record<string, unknown>): AIPreview {
  const s = getAISettings();
  const t = previewTransport(s);
  const tk = TASK_ALIASES[task] ?? 'personalise';
  const pa = args as PromptArgs & { plan?: CarePlan; mother?: Mother };
  const shape = t ?? { compact: false, deidentify: true };
  let built;
  try {
    built = buildPrompt(tk, pa, shape);
  } catch (e) {
    return { text: `(Preview unavailable: ${(e as Error).message})`, removed: [], categories: [], provider: t?.id ?? 'template', mode: s.mode, wouldSend: false, bytes: 0 };
  }
  const constrainedSkip = t && (s.mode === 'on_device' || s.mode === 'any_app') && !CONSTRAINED.includes(tk);
  const wouldSend = Boolean(t) && !constrainedSkip;
  const header = !t
    ? 'AI is off. Nothing is sent. If AI were switched on, this is what would be sent:\n\n'
    : constrainedSkip
      ? 'This mode does not send this task; Gaskin uses its templates. For reference, a full AI would be sent:\n\n'
      : '';
  return {
    text: header + built.prompt,
    removed: built.removed,
    categories: built.categories,
    provider: t?.id ?? 'template',
    mode: s.mode,
    wouldSend,
    bytes: wouldSend ? byteLength(built.prompt) : 0,
  };
}

registerPreviewBuilder(buildPreview);

// ---------- Where the worker's own key is kept (see keyStore.ts for the UI wiring) ----------
export { saveAISettings, loadAISettings, forgetAIKey, keyPersistence, needsKeyAgain, AI_SETTINGS_STORAGE_KEY } from './keyStore';
export type { KeyPersistence } from './keyStore';
