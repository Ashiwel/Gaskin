/**
 * Where the worker's own AI key is kept between visits.
 *
 * AI settings are saved in browser storage so Gaskin starts with them. The API key is the one secret in
 * them: anyone who opens this browser's developer tools, or any script that runs in the page, can read
 * localStorage. On a shared laptop or a facility phone that matters. So the key has its own setting:
 *
 *  - 'device'  (default, as before): saved on this device with the other settings.
 *  - 'session': kept until this tab is closed (sessionStorage), then asked for again.
 *  - 'memory' : never written anywhere; asked for again after every reload.
 *
 * Saved settings never hold the key under 'session' or 'memory'. The key is sent only to the endpoint
 * the worker configured, and never appears in the audit log or status messages (see pipeline.ts).
 *
 * UI wiring (for the Settings and onboarding screens): call `saveAISettings(settings, persistence)` instead
 * of writing localStorage directly, `loadAISettings()` at start-up instead of reading it, and
 * `forgetAIKey()` for a "Remove my key from this device" button. `keyPersistence()` gives the current choice.
 */
import type { AISettings } from './settings';

export type KeyPersistence = 'device' | 'session' | 'memory';

export const AI_SETTINGS_STORAGE_KEY = 'gaskin.ai-settings.v1';
const PERSIST_KEY = 'gaskin.ai-key-persistence.v1';
const SESSION_KEY = 'gaskin.ai-key.session.v1';

let memoryKey: string | undefined;

function ls(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}
function ss(): Storage | undefined {
  try {
    return globalThis.sessionStorage ?? undefined;
  } catch {
    return undefined;
  }
}

export function keyPersistence(): KeyPersistence {
  const v = ls()?.getItem(PERSIST_KEY);
  return v === 'session' || v === 'memory' ? v : 'device';
}

/** Save AI settings. The key goes where `persistence` says; the rest is always saved on the device. */
export function saveAISettings(s: AISettings, persistence: KeyPersistence = keyPersistence()): void {
  const key = s.ownKey?.apiKey ?? '';
  const withoutKey: AISettings = s.ownKey ? { ...s, ownKey: { ...s.ownKey, apiKey: '' } } : s;
  try {
    ls()?.setItem(PERSIST_KEY, persistence);
    ls()?.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(persistence === 'device' ? s : withoutKey));
    if (persistence === 'session' && key) ss()?.setItem(SESSION_KEY, key);
    else ss()?.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: settings live for this page only */
  }
  memoryKey = key || undefined;
}

/** Saved settings with the key put back from wherever it was kept, or null if nothing was saved. */
export function loadAISettings(): AISettings | null {
  let raw: string | null | undefined;
  try {
    raw = ls()?.getItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return null;
  let s: AISettings;
  try {
    s = JSON.parse(raw) as AISettings;
  } catch {
    return null;
  }
  if (s.ownKey && !s.ownKey.apiKey) {
    const p = keyPersistence();
    const key = p === 'session' ? (ss()?.getItem(SESSION_KEY) ?? undefined) : p === 'memory' ? memoryKey : undefined;
    if (key) s = { ...s, ownKey: { ...s.ownKey, apiKey: key } };
  }
  return s;
}

/** True when settings ask for the worker's own key but none is available (ask her for it again) */
export function needsKeyAgain(s: AISettings | null = loadAISettings()): boolean {
  return !!s && s.mode === 'own_key' && !!s.ownKey && s.ownKey.kind !== 'openai_compatible' && !s.ownKey.apiKey;
}

/** Remove the key from every place it could be kept. Other AI settings stay. */
export function forgetAIKey(): void {
  memoryKey = undefined;
  try {
    ss()?.removeItem(SESSION_KEY);
    const raw = ls()?.getItem(AI_SETTINGS_STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as AISettings;
      if (s.ownKey) ls()?.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify({ ...s, ownKey: { ...s.ownKey, apiKey: '' } }));
    }
  } catch {
    /* nothing to remove */
  }
}
