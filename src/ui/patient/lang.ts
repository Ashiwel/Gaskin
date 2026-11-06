/**
 * Language helpers for the patient screens: which languages can be offered to her (installed
 * packs, plus "Coming soon" for languages with no pack), and one call that renders a template key
 * or free English text in any of them with its confidence.
 */
import type { LanguageCode } from '../../types';
import { LANGUAGE_NAMES } from '../../data';
import { englishTemplate, getPack, installedLanguages, isPackCode, renderMotherText, renderUntemplated, summarisePack, type Confidence, type PackCode } from '../../i18n';

export interface LangOption {
  code: string;
  label: string;
  nativeName: string;
  /** No pack in this build: shown as "Coming soon" and not selectable */
  comingSoon: boolean;
  /** Pack exists but is not installed on this device */
  notInstalled: boolean;
  status?: 'reviewed' | 'machine_draft' | 'partial' | 'none';
}

/** Her language first, then installed packs, then her country's languages with no pack yet. */
export function languageOptions(motherLang: LanguageCode | string, countryLangs: LanguageCode[] = []): LangOption[] {
  const installed = new Set<string>(safeInstalled());
  const codes = Array.from(new Set<string>([String(motherLang), ...installed, ...countryLangs, 'en']));
  return codes.map((code) => {
    if (!isPackCode(code)) {
      return { code, label: LANGUAGE_NAMES[code as LanguageCode] ?? code, nativeName: LANGUAGE_NAMES[code as LanguageCode] ?? code, comingSoon: true, notInstalled: true };
    }
    const s = summarisePack(code);
    const comingSoon = s.status === 'none' && code !== 'en';
    return { code, label: s.name, nativeName: s.nativeName, comingSoon, notInstalled: !installed.has(code) && code !== 'en', status: s.status };
  });
}

function safeInstalled(): PackCode[] {
  try {
    return installedLanguages();
  } catch {
    return ['en'];
  }
}

export interface Line {
  text: string;
  english: string;
  lang: string;
  confidence: Confidence;
  dir: 'ltr' | 'rtl';
}

/** A template key (MOTHER_TEXT, VISIT_TEXT, PLAN_TEXT) in her language, or plain English text. */
export function lineFor(lang: string, key: string | undefined, english: string, params?: Record<string, string | number>): Line {
  const code: PackCode = isPackCode(lang) ? lang : 'en';
  try {
    if (key && englishTemplate(key) !== undefined) {
      const r = renderMotherText(key, params ?? {}, code);
      return { text: r.text, english: r.english, lang: r.lang, confidence: r.confidence, dir: r.dir };
    }
  } catch {
    /* fall back to English */
  }
  const r = renderUntemplated(english, code);
  return { text: r.text, english, lang: r.lang, confidence: r.confidence, dir: r.dir };
}

export function nativeName(code: string): string {
  try {
    return isPackCode(code) ? getPack(code).nativeName : (LANGUAGE_NAMES[code as LanguageCode] ?? code);
  } catch {
    return code;
  }
}

export function worstConfidence(cs: Confidence[]): Confidence {
  if (cs.includes('fallback')) return 'fallback';
  if (cs.includes('draft')) return 'draft';
  return 'reviewed';
}
