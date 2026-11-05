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

export interface Persona {
  id: 'lagos' | 'kano' | 'crossriver';
  title: string;
  blurb: string;
  /** Demo worker to act as */
  workerId: string;
  answers: SetupAnswers;
}

export const PERSONAS: Persona[] = [
  {
    id: 'lagos',
    title: 'Lagos midwife on a smartphone',
    blurb: 'Android phone with 4G, mothers speak Yoruba, Igbo, English and Pidgin. AI by copy and paste, or Claude when opened in Claude.',
    workerId: 'w-ng-bisola',
    answers: {
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
    workerId: 'w-ng-zainab',
    answers: {
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
    workerId: 'w-ng-kemi',
    answers: {
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
