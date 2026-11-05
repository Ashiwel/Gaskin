/**
 * Runtime AI settings. The UI stores them in browser storage on the
 * device; API keys never leave the device except to the endpoint the
 * worker chose. Gaskin works fully in 'none' mode (offline templates).
 */
export type AISettings = {
  mode: 'auto' | 'none' | 'claude_here' | 'own_key' | 'on_device' | 'any_app';
  ownKey?: { kind: 'openai_compatible' | 'anthropic' | 'gemini'; baseUrl?: string; model: string; apiKey: string };
  onDevice?: { kind: 'local_server' | 'in_browser'; baseUrl?: string; model: string; /** default true */ deidentify?: boolean };
};

export type AISettingsMode = AISettings['mode'];

export interface ProviderOption {
  /** Same as mode; `id` is kept for UIs that key options by id */
  id: AISettingsMode;
  mode: AISettingsMode;
  label: string;
  description: string;
  /** What the worker needs to use it */
  needs: string;
  cost: string;
  privacy: string;
  /** Data leaves the device */
  leavesDevice: boolean;
  /** Tasks it runs with a model; the rest use templates */
  tasks: string;
  /** Settings fields this mode uses */
  fields?: Array<'ownKey' | 'onDevice'>;
  /** Suggested presets for the settings form */
  presets?: Array<{ label: string; kind: string; baseUrl?: string; model: string }>;
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'none',
    mode: 'none',
    label: 'No AI (offline templates)',
    description: 'Gaskin writes messages from its approved templates in English and Nigerian Pidgin, reads doctors\' reports with built-in patterns, and explains plans from their own reasons.',
    needs: 'Nothing. Works offline on any phone.',
    cost: 'Free.',
    privacy: 'Nothing leaves this device.',
    leavesDevice: false,
    tasks: 'All tasks, using templates. Other languages are marked for the worker to translate.',
  },
  {
    id: 'auto',
    mode: 'auto',
    label: 'Automatic',
    description: 'Uses Claude when this page runs inside Claude, a server set up by your organisation if there is one, and the offline templates otherwise.',
    needs: 'Nothing to set up.',
    cost: 'Free to the worker where the organisation or viewer provides the AI.',
    privacy: 'Names, phone numbers, places and dates are removed before anything is sent.',
    leavesDevice: true,
    tasks: 'All tasks.',
  },
  {
    id: 'claude_here',
    mode: 'claude_here',
    label: 'Claude (in this page)',
    description: 'Live Claude through the Claude app this page is open in. The first request asks you to allow it.',
    needs: 'This page opened inside Claude, signed in.',
    cost: 'Uses your own Claude plan\'s usage.',
    privacy: 'De-identified text goes to Anthropic through your Claude account. Pseudonymised data can still be personal data, so her consent to AI use applies.',
    leavesDevice: true,
    tasks: 'All tasks.',
  },
  {
    id: 'own_key',
    mode: 'own_key',
    label: 'Your own AI key',
    description: 'Any OpenAI-compatible service (OpenAI, OpenRouter, Groq, Together, or your organisation\'s server), the Claude API, or Google Gemini.',
    needs: 'An API key and a model name. The key is stored only on this device.',
    cost: 'Paid by whoever owns the key; a typical message costs well under one US cent. Some services have free tiers.',
    privacy: 'De-identified text goes to the service you choose. A data processing agreement with that service is still required under the NDPA, Kenya DPA and Ghana DPA.',
    leavesDevice: true,
    tasks: 'All tasks.',
    fields: ['ownKey'],
    presets: [
      { label: 'OpenAI', kind: 'openai_compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      { label: 'OpenRouter', kind: 'openai_compatible', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
      { label: 'Groq', kind: 'openai_compatible', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
      { label: 'Together', kind: 'openai_compatible', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
      { label: 'Claude API', kind: 'anthropic', model: 'claude-haiku-4-5' },
      { label: 'Google Gemini', kind: 'gemini', model: 'gemini-2.0-flash' },
    ],
  },
  {
    id: 'on_device',
    mode: 'on_device',
    label: 'On this device',
    description: 'A small open model on this laptop or the facility hub (Ollama, LM Studio, vLLM), or inside the browser on phones and laptops with WebGPU.',
    needs: 'A local AI server, or a device with WebGPU and a one-time download of about 1 GB.',
    cost: 'Free after setup.',
    privacy: 'Nothing leaves this device or the facility network. Names are still removed by default.',
    leavesDevice: false,
    tasks: 'Message wording, translation and report reading only (small models are checked strictly; templates cover the rest).',
    fields: ['onDevice'],
    presets: [
      { label: 'Ollama on this laptop', kind: 'local_server', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:3b' },
      { label: 'LM Studio on this laptop', kind: 'local_server', baseUrl: 'http://localhost:1234/v1', model: 'qwen2.5-3b-instruct' },
      { label: 'In the browser: Qwen 2.5 1.5B', kind: 'in_browser', model: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' },
      { label: 'In the browser: Llama 3.2 1B', kind: 'in_browser', model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' },
      { label: 'In the browser: Gemma 2 2B', kind: 'in_browser', model: 'gemma-2-2b-it-q4f16_1-MLC' },
    ],
  },
  {
    id: 'any_app',
    mode: 'any_app',
    label: 'Any AI app (copy and paste)',
    description: 'Use the free AI app you already have: ChatGPT, Gemini, Meta AI in WhatsApp, or Claude. Gaskin gives you a short request to copy; you paste the reply back and Gaskin checks it.',
    needs: 'Any AI chat app on your phone.',
    cost: 'Free, using your own app.',
    privacy: 'Only the de-identified request you copy is shared, under your app\'s own terms. Her consent to AI use applies.',
    leavesDevice: true,
    tasks: 'Message wording, translation and report reading only; templates cover the rest.',
  },
];

const VALID_MODES = new Set<AISettingsMode>(PROVIDER_OPTIONS.map((o) => o.mode));

let settings: AISettings = { mode: 'auto' };

export function getAISettings(): AISettings {
  return JSON.parse(JSON.stringify(settings)) as AISettings;
}

/** Validate and normalise settings. Throws with a plain-English message if unusable. */
export function normaliseSettings(s: AISettings): AISettings {
  if (!s || !VALID_MODES.has(s.mode)) throw new Error(`Unknown AI mode "${(s as { mode?: string })?.mode}".`);
  const out: AISettings = { mode: s.mode };
  if (s.ownKey) {
    const k = s.ownKey;
    if (!['openai_compatible', 'anthropic', 'gemini'].includes(k.kind)) throw new Error(`Unknown key type "${k.kind}".`);
    out.ownKey = { kind: k.kind, model: String(k.model ?? '').trim(), apiKey: String(k.apiKey ?? '').trim(), baseUrl: k.baseUrl?.trim() || undefined };
  }
  if (s.onDevice) {
    const d = s.onDevice;
    if (!['local_server', 'in_browser'].includes(d.kind)) throw new Error(`Unknown on-device type "${d.kind}".`);
    out.onDevice = { kind: d.kind, model: String(d.model ?? '').trim(), baseUrl: d.baseUrl?.trim() || undefined, deidentify: d.deidentify !== false };
  }
  if (out.mode === 'own_key') {
    if (!out.ownKey) throw new Error('Choose a service and enter your API key.');
    if (!out.ownKey.model) throw new Error('Enter a model name.');
    if (out.ownKey.kind === 'openai_compatible' && !out.ownKey.baseUrl) throw new Error('Enter the service address (base URL).');
    if (out.ownKey.kind !== 'openai_compatible' && !out.ownKey.apiKey) throw new Error('Enter your API key.');
  }
  if (out.mode === 'on_device') {
    if (!out.onDevice) throw new Error('Choose a local server or in-browser model.');
    if (!out.onDevice.model) throw new Error('Enter a model name.');
  }
  return out;
}

/** Internal: set without side effects (index.ts wraps this to reset the provider) */
export function _setSettings(s: AISettings): void {
  settings = s;
}
