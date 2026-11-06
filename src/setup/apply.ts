/**
 * Apply a SetupPlan: storage, language packs, AI, location profile, then save the setup.
 * Each step reports progress and never throws; a failed step falls back and says so.
 * The wizard calls this from the "Set it up" button. Storage goes first because choosing
 * a folder needs the button press (browsers only open the folder picker from a click).
 */
import { configureAI, saveAISettings, type AISettings } from '../ai';
import { installPack, isPackCode } from '../i18n';
import { buildLocationProfile, saveLocationProfile, type LocationProfile } from '../location';
import { getAppStore, type GaskinStore } from '../storage';
import { AI_SETTINGS_KEY, setupStore, type SavedSetup } from './store';
import type { SetupAnswers, SetupPlan } from './types';

export type ApplyStepId = 'storage' | 'languages' | 'ai' | 'place';
export interface ApplyProgress {
  step: ApplyStepId;
  state: 'running' | 'done' | 'fallback' | 'skipped';
  /** Plain note for the worker, e.g. "Hausa ready" or "No key given: copy and paste for now" */
  note?: string;
  /** 0..1 for language downloads */
  progress?: number;
}

export interface ApplyOptions {
  /** API key typed on the summary screen (own_key mode) */
  apiKey?: string;
  onProgress?: (p: ApplyProgress) => void;
  /** Fetch open datasets for the location profile (default: only when online and a position was shared) */
  online?: boolean;
  /** Language pack download duration override (tests) */
  packDurationMs?: number;
  /** Test seams */
  deps?: {
    installPack?: typeof installPack;
    configureAI?: typeof configureAI;
    getStore?: () => Promise<GaskinStore<unknown>>;
    buildLocationProfile?: typeof buildLocationProfile;
  };
}

export interface ApplyResult {
  saved: SavedSetup;
  location: LocationProfile | null;
  aiSettings: AISettings;
  aiError?: string;
  installed: string[];
}

function persistAI(s: AISettings) {
  // Through the AI layer, so the worker's choice of where her key is kept (device, tab or memory) is honoured
  saveAISettings(s);
  void AI_SETTINGS_KEY;
}

export async function applySetupPlan(plan: SetupPlan, answers: SetupAnswers, opts: ApplyOptions = {}): Promise<ApplyResult> {
  const say = (p: ApplyProgress) => {
    try {
      opts.onProgress?.(p);
    } catch {
      /* ignore */
    }
  };
  const install = opts.deps?.installPack ?? installPack;
  const configure = opts.deps?.configureAI ?? configureAI;
  const getStore = opts.deps?.getStore ?? (() => getAppStore<unknown>({ describeAs: plan.run.where === 'laptop_usb' ? 'usb' : 'folder', backupEveryDays: plan.storage.backupEveryDays }));
  const build = opts.deps?.buildLocationProfile ?? buildLocationProfile;

  // 1. Storage (first: the folder picker needs the click that started this)
  say({ step: 'storage', state: 'running' });
  let storageMode: string = plan.storage.mode;
  try {
    const store = await getStore();
    if (plan.storage.mode === 'folder') {
      const ok = await store.chooseFolder();
      if (ok) say({ step: 'storage', state: 'done', note: store.status().message });
      else {
        await store.setMode('browser');
        storageMode = 'browser';
        say({ step: 'storage', state: 'fallback', note: 'No folder chosen. Records stay in this browser for now; choose a folder later in Settings.' });
      }
    } else {
      await store.setMode(plan.storage.mode);
      say({ step: 'storage', state: 'done', note: plan.storage.label });
    }
  } catch {
    storageMode = 'browser';
    say({ step: 'storage', state: 'fallback', note: 'Records stay in this browser.' });
  }

  // 2. Language packs, one after another so progress is easy to follow on a slow phone
  say({ step: 'languages', state: 'running', progress: 0 });
  const installed: string[] = [];
  const codes = plan.languages.install.filter((c) => isPackCode(c));
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    try {
      await install(code, { durationMs: opts.packDurationMs, onProgress: (p) => say({ step: 'languages', state: 'running', progress: (i + p) / codes.length, note: code }) });
      installed.push(code);
    } catch {
      /* a failed pack falls back to English for that language */
    }
  }
  say({ step: 'languages', state: installed.length === codes.length ? 'done' : 'fallback', progress: 1, note: codes.length ? `${installed.length} of ${codes.length} ready` : 'English only' });

  // 3. AI, with de-identification on. A missing key drops to copy and paste; any error drops to templates.
  say({ step: 'ai', state: 'running' });
  let ai: AISettings = plan.ai.settings;
  let aiError: string | undefined;
  if (ai.mode === 'own_key' && ai.ownKey) {
    const key = (opts.apiKey ?? '').trim();
    ai = key ? { ...ai, ownKey: { ...ai.ownKey, apiKey: key } } : { mode: 'any_app' };
  }
  if (ai.mode === 'on_device' && ai.onDevice) ai = { ...ai, onDevice: { ...ai.onDevice, deidentify: true } };
  try {
    ai = configure(ai);
    say({ step: 'ai', state: ai.mode === plan.ai.settings.mode ? 'done' : 'fallback', note: ai.mode === 'any_app' && plan.ai.mode === 'own_key' ? 'No key given: copy and paste for now. Add a key later in Settings.' : undefined });
  } catch (e) {
    aiError = (e as Error)?.message ?? String(e);
    try {
      ai = configure({ mode: 'none' });
    } catch {
      ai = { mode: 'none' };
    }
    say({ step: 'ai', state: 'fallback', note: `${aiError} Using templates for now.` });
  }
  persistAI(ai);

  // 4. Location profile
  say({ step: 'place', state: 'running' });
  let location: LocationProfile | null = null;
  if (plan.country !== 'other' && plan.region) {
    try {
      location = await build(
        { country: plan.country, region: plan.region, district: plan.district, lat: answers.geo?.lat, lon: answers.geo?.lon },
        { online: opts.online ?? false },
      );
      saveLocationProfile(location);
      say({ step: 'place', state: 'done', note: location.region });
    } catch {
      say({ step: 'place', state: 'fallback', note: 'Using national advice.' });
    }
  } else {
    say({ step: 'place', state: 'skipped', note: 'National advice for now.' });
  }

  const saved: SavedSetup = {
    plan,
    answers: { ...answers, geo: answers.geo ? { lat: Math.round(answers.geo.lat * 100) / 100, lon: Math.round(answers.geo.lon * 100) / 100 } : undefined },
    completedAt: new Date().toISOString(),
    applied: { languages: installed, aiMode: ai.mode, aiError, storageMode, locationProfileId: location?.id ?? null },
  };
  setupStore.set(saved);
  return { saved, location, aiSettings: ai, aiError, installed };
}
