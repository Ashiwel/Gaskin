/**
 * Thin bridge to the language packs. Until src/i18n exists (or for keys it
 * does not know), English text passed as the fallback is shown.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { LanguageCode } from '../types';

type TFn = (key: string, lang: string) => string | undefined;
let packT: TFn | null = null;

/** Called once at startup when the i18n module is present. */
export function registerTranslator(fn: TFn | null) {
  packT = fn;
}

const LangCtx = createContext<string>('en');

export function WorkerLanguage({ lang, children }: { lang: string; children: ReactNode }) {
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
}

export function useWorkerLang(): string {
  return useContext(LangCtx);
}

/** Translate a UI string; falls back to the English text given. */
export function useT() {
  const lang = useWorkerLang();
  return (key: string, english: string): string => {
    if (lang === 'en' || !packT) return english;
    try {
      const out = packT(key, lang);
      return out && out !== key ? out : english;
    } catch {
      return english;
    }
  };
}

export const RTL_LANGS = new Set<string>(['ar', 'ha-Arab', 'ur', 'fa', 'he']);
export function dirFor(lang: string | LanguageCode): 'rtl' | 'ltr' {
  return RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
}
