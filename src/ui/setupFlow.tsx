/**
 * Setup wiring: first launch opens the onboarding wizard; "Here is your setup" applies languages,
 * AI (de-identification on), the assistant connection, location and storage, then lands on Today.
 * Three preset personas apply a setup at once so a reviewer can skip the questions.
 */
import { useEffect, type ReactNode } from 'react';
import type { LanguageCode } from '../types';
import { applySetupPlan, recommendSetup, resetSetup, useSetup, type SavedSetup, type SetupAnswers } from '../setup';
import { isPackCode, t as packT, type PackCode } from '../i18n';
import { registerTranslator, WorkerLanguage, dirFor } from './i18n';
import '../setup/connectAssistant';
import type { Mother, Worker } from '../types';
import { seedDemoProfiles } from './accounts/auth';

export interface Persona {
  id: 'lagos' | 'kano' | 'crossriver';
  title: string;
  blurb: string;
  /** Short facts for the persona card */
  facts: string[];
  /** Demo worker to act as */
  workerId: string;
  answers: SetupAnswers & { audience?: string; countryCode?: string };
}

export const PERSONAS: Persona[] = [
  {
    id: 'lagos',
    title: 'Lagos midwife on a smartphone',
    blurb: 'Android phone with 4G, mothers speak Yoruba, Igbo, English and Pidgin. AI by copy and paste, or Claude when opened in Claude.',
    facts: ['Smartphone, 4G', 'Yorùbá, Igbo, English', 'AI on'],
    workerId: 'w-ng-bisola',
    answers: {
      audience: 'health_worker',
      countryCode: 'NG',
      workerLanguage: 'en',
      role: 'midwife',
      country: 'NG',
      region: 'Lagos',
      mothersLanguages: ['yo', 'ig', 'en', 'pcm'],
      devices: ['android_phone'],
      internet: 'fourg',
      dataBudget: 'medium',
      electricity: 'some_hours',
      printer: 'facility',
      aiApps: ['meta_ai'],
      aiPay: 'free_only',
      caseload: '50_150',
      setupBy: 'myself',
      techComfort: 3,
    },
  },
  {
    id: 'kano',
    title: 'Kano CHEW with a shared basic phone',
    blurb: 'No internet, power some days, Hausa screens. No AI: the rules and templates do everything.',
    facts: ['Shared basic phone', 'Hausa screens', 'No AI'],
    workerId: 'w-ng-zainab',
    answers: {
      audience: 'health_worker',
      countryCode: 'NG',
      workerLanguage: 'ha',
      role: 'chew',
      country: 'NG',
      region: 'Kano',
      mothersLanguages: ['ha', 'ff'],
      devices: ['shared_basic_phone'],
      internet: 'none',
      electricity: 'rarely',
      printer: 'none',
      aiApps: ['none'],
      caseload: '20_50',
      setupBy: 'programme',
      techComfort: 1,
    },
  },
  {
    id: 'crossriver',
    title: 'Cross River CHEW with an old Windows laptop',
    blurb: 'Patchy 3G, Gaskin runs from a USB stick, mothers speak English and Pidgin. No AI unless opened in Claude.',
    facts: ['Old laptop, USB stick', 'English, Pidgin', 'Patchy 3G'],
    workerId: 'w-ng-kemi',
    answers: {
      audience: 'health_worker',
      countryCode: 'NG',
      workerLanguage: 'en',
      role: 'chew',
      country: 'NG',
      region: 'Cross River',
      district: 'Ikom',
      mothersLanguages: ['en', 'pcm'],
      devices: ['laptop', 'basic_phone'],
      computerOs: 'windows_old',
      internet: 'patchy',
      dataBudget: 'tiny',
      electricity: 'some_hours',
      printer: 'lga_office',
      aiApps: ['none'],
      caseload: '50_150',
      setupBy: 'supervisor',
      techComfort: 2,
    },
  },
];

/** Apply a persona at once: recommend, apply (no folder picker: browser storage), save. */
export async function applyPersona(p: Persona, inClaude: boolean): Promise<SavedSetup> {
  const plan = recommendSetup(p.answers, { inClaude });
  // A preset cannot open the folder picker (no click on a chooser), so it keeps records in the browser.
  const quick = plan.storage.mode === 'folder' ? { ...plan, storage: { ...plan.storage, mode: 'browser' as const, label: 'This browser (choose a USB folder later in Settings)' } } : plan;
  const r = await applySetupPlan(quick, p.answers, { packDurationMs: 250 });
  return r.saved;
}

/**
 * Start as a persona: apply her setup, add demo profiles (PIN 1234) for her and her colleagues,
 * sign her in and make her the acting worker.
 */
export async function startPersona(p: Persona, inClaude: boolean, data: { workers: Worker[]; mothers: Mother[] }, setWorker: (id: string) => void): Promise<void> {
  await seedDemoProfiles(data.workers, data.mothers, p.workerId).catch(() => undefined);
  setWorker(p.workerId);
  try {
    await applyPersona(p, inClaude);
  } catch {
    /* applySetupPlan never throws */
  }
  setWorker(p.workerId);
}

/** The worker's interface language from the saved setup ('en' before setup). */
export function workerLangOf(saved: SavedSetup | null): PackCode {
  const ui = saved?.plan.languages.ui;
  return ui && isPackCode(ui) ? ui : 'en';
}

/** Languages chosen for mothers at setup (first non-English one is the onboarding default) */
export function onboardingMotherDefault(saved: SavedSetup | null): LanguageCode | undefined {
  const ms = saved?.plan.languages.mothers ?? [];
  return ms.find((l) => l !== 'en' && l !== 'pcm') ?? ms[0];
}

let registered = false;
function ensureTranslator() {
  if (registered) return;
  registered = true;
  registerTranslator((key, lang) => {
    if (!isPackCode(lang)) return undefined;
    const out = packT(key as never, lang);
    return out === key ? undefined : out;
  });
}

/** Wraps the app in the worker's language from setup; sets <html lang dir>. */
export function WorkerLanguageFromSetup({ children }: { children: ReactNode }) {
  ensureTranslator();
  const saved = useSetup();
  const lang = workerLangOf(saved);
  useEffect(() => {
    try {
      document.documentElement.lang = lang === 'en' ? 'en-GB' : lang;
      document.documentElement.dir = dirFor(lang);
    } catch {
      /* ignore */
    }
  }, [lang]);
  return <WorkerLanguage lang={lang}>{children}</WorkerLanguage>;
}

export { resetSetup };
