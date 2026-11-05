import type { CountryCode, LanguageCode } from '../types';

/**
 * Where each patient's language comes from (founder rule, 5 Nov):
 * the worker's language drives the whole interface; each patient gets a language at
 * registration, used only for mother-facing content (mother text, Show to mother,
 * handouts and messages). The default is the language of her location, and the midwife
 * can change it for each patient.
 *
 * Accepts the engine's LocationProfile or anything with a country and region
 * (a Mother works too). An explicit `language` on the profile wins.
 */
export interface LocationLike {
  country: CountryCode;
  region: string;
  language?: LanguageCode;
}

/**
 * Most widely spoken Gaskin language by region. Where the main local language has no pack
 * (Kanuri in Borno, Ga in Greater Accra, Gurene in Upper East, Ijaw/Ikwerre in Rivers, Turkana),
 * the regional lingua franca is used; Pidgin is never chosen here.
 */
export const REGION_LANGUAGE: Record<string, LanguageCode> = {
  // Nigeria
  Lagos: 'yo',
  Oyo: 'yo',
  Ogun: 'yo',
  Osun: 'yo',
  Ondo: 'yo',
  Ekiti: 'yo',
  Kwara: 'yo',
  Kano: 'ha',
  Kaduna: 'ha',
  Katsina: 'ha',
  Jigawa: 'ha',
  Sokoto: 'ha',
  Zamfara: 'ha',
  Kebbi: 'ha',
  Bauchi: 'ha',
  Gombe: 'ha',
  Borno: 'ha',
  Yobe: 'ha',
  Adamawa: 'ff',
  Enugu: 'ig',
  Anambra: 'ig',
  Imo: 'ig',
  Abia: 'ig',
  Ebonyi: 'ig',
  Edo: 'bin',
  Delta: 'urh',
  Rivers: 'en',
  // Kenya
  Nairobi: 'sw',
  Mombasa: 'sw',
  Kilifi: 'sw',
  Kwale: 'sw',
  Turkana: 'sw',
  Kisumu: 'luo',
  Siaya: 'luo',
  'Homa Bay': 'luo',
  Migori: 'luo',
  // Ghana
  'Greater Accra': 'tw',
  Ashanti: 'tw',
  'Bono East': 'tw',
  Eastern: 'tw',
  Northern: 'dag',
  Volta: 'ee',
  'Upper East': 'en',
};

/** When the region is unknown: the national language most mothers can follow */
const COUNTRY_DEFAULT: Record<CountryCode, LanguageCode> = { NG: 'en', KE: 'sw', GH: 'en' };

export function defaultPatientLanguage(location: LocationLike | undefined, onboardingDefault?: LanguageCode): LanguageCode {
  if (location?.language) return location.language;
  if (location) {
    const byRegion = REGION_LANGUAGE[location.region] ?? REGION_LANGUAGE[location.region.replace(/\s+(State|County|Region)$/i, '')];
    if (byRegion) return byRegion;
  }
  if (onboardingDefault) return onboardingDefault;
  if (location) return COUNTRY_DEFAULT[location.country] ?? 'en';
  return 'en';
}
