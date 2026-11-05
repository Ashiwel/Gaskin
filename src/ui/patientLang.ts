/**
 * Her language is used only for mother-facing content: plan mother text, alerts' mother text,
 * Show to mother, handouts and messages. The worker's own screens use the worker's language.
 */
import type { LanguageCode, Mother } from '../types';
import { defaultPatientLanguage, isPackCode, type PackCode } from '../i18n';
import { getSetupPlan } from '../setup';

/** Default for a new registration: her location's language, then the onboarding default. */
export function defaultLanguageFor(loc: { country: Mother['country']; region: string }): LanguageCode {
  const plan = getSetupPlan();
  const onboarding = plan?.languages.mothers.find((l) => l !== 'en' && l !== 'pcm');
  return defaultPatientLanguage(loc, onboarding);
}

/** The language pack used for her side of the screen (English when no pack exists). */
export function motherLanguageOf(m: Pick<Mother, 'language' | 'country' | 'region'>): PackCode {
  const l = m.language ?? defaultPatientLanguage(m);
  return isPackCode(l) ? l : 'en';
}
