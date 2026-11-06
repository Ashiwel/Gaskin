import type { CountryCode, LanguageCode } from '../types';
import type { PackCode } from './types';
import { defaultLanguageForPlace, languagesFor, packFor, packStateFor, NO_PACK_NOTE, type PackState } from '../geo/languages';

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
  /** Launch country code, or any ISO 3166-1 alpha-2 */
  country: CountryCode | (string & {});
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

/** Which country each REGION_LANGUAGE entry belongs to, so 'Eastern' or 'Northern' never matches in another country */
const REGION_COUNTRY: Record<string, CountryCode> = {};
for (const r of ['Lagos', 'Oyo', 'Ogun', 'Osun', 'Ondo', 'Ekiti', 'Kwara', 'Kano', 'Kaduna', 'Katsina', 'Jigawa', 'Sokoto', 'Zamfara', 'Kebbi', 'Bauchi', 'Gombe', 'Borno', 'Yobe', 'Adamawa', 'Enugu', 'Anambra', 'Imo', 'Abia', 'Ebonyi', 'Edo', 'Delta', 'Rivers']) REGION_COUNTRY[r] = 'NG';
for (const r of ['Nairobi', 'Mombasa', 'Kilifi', 'Kwale', 'Turkana', 'Kisumu', 'Siaya', 'Homa Bay', 'Migori']) REGION_COUNTRY[r] = 'KE';
for (const r of ['Greater Accra', 'Ashanti', 'Bono East', 'Eastern', 'Northern', 'Volta', 'Upper East']) REGION_COUNTRY[r] = 'GH';

/** When the region is unknown: the national language most mothers can follow */
const COUNTRY_DEFAULT: Record<CountryCode, LanguageCode> = { NG: 'en', KE: 'sw', GH: 'en' };

const isLaunch = (c: string): c is CountryCode => c === 'NG' || c === 'KE' || c === 'GH';

/** Her language as a BCP-47 tag, and the pack that renders it (none: plain English, "Coming soon") */
export interface PatientLanguage {
  tag: string;
  packCode?: PackCode;
  pack: PackState;
}

function regionTable(country: string, region: string): LanguageCode | undefined {
  const key = REGION_LANGUAGE[region] !== undefined ? region : region.replace(/\s+(State|County|Region)$/i, '');
  const hit = REGION_LANGUAGE[key];
  return hit && REGION_COUNTRY[key] === country ? hit : undefined;
}

/**
 * The default language for a new patient.
 *
 * New form: defaultPatientLanguage(country, region?, area?, opts?) returns { tag, packCode?, pack } for any
 * country, from src/geo (curated areas and regions, then CLDR), never another country's languages,
 * never Pidgin. `opts.explicit` (her recorded tag) wins; `opts.onboardingDefault` is used when the place
 * gives nothing.
 *
 * Legacy form (kept for existing callers): defaultPatientLanguage(location?, onboardingDefault?) returns a
 * LanguageCode pack code: explicit language, region table, onboarding default, country default; outside
 * Nigeria, Kenya and Ghana the place's first language with a LanguageCode pack, else English.
 */
export function defaultPatientLanguage(country: string, region?: string, area?: string, opts?: { explicit?: string; onboardingDefault?: string }): PatientLanguage;
export function defaultPatientLanguage(location: LocationLike | undefined, onboardingDefault?: LanguageCode): LanguageCode;
export function defaultPatientLanguage(
  a: string | LocationLike | undefined,
  b?: string,
  c?: string,
  opts: { explicit?: string; onboardingDefault?: string } = {},
): PatientLanguage | LanguageCode {
  if (typeof a === 'string') {
    const cc = a.toUpperCase();
    if (!opts.explicit && isLaunch(cc) && b && !c) {
      // Keep the hand-checked launch-region table where it has an answer
      const hit = regionTable(cc, b);
      if (hit) return { tag: hit, packCode: hit, pack: packStateFor(hit) };
    }
    const r = defaultLanguageForPlace({ country: cc, region: b, area: c }, opts);
    return { tag: r.tag, ...(r.packCode ? { packCode: r.packCode } : {}), pack: r.pack };
  }
  const location = a;
  const onboardingDefault = b as LanguageCode | undefined;
  if (location?.language) return location.language;
  if (location) {
    const cc = String(location.country ?? '').toUpperCase();
    const byRegion = location.region ? regionTable(cc, location.region) : undefined;
    if (byRegion) return byRegion;
    if (!isLaunch(cc)) {
      const first = languagesFor(cc, location.region).find((l) => l.tag !== 'pcm' && l.packCode && isCore(l.packCode));
      return (first?.packCode as LanguageCode | undefined) ?? 'en';
    }
  }
  if (onboardingDefault) return onboardingDefault;
  if (location) return COUNTRY_DEFAULT[location.country as CountryCode] ?? 'en';
  return 'en';
}

const CORE = new Set<string>(['en', 'pcm', 'ha', 'yo', 'ig', 'sw', 'tw', 'bin', 'urh', 'ar', 'dag', 'luo', 'ee', 'ff']);
const isCore = (c: string): c is LanguageCode => CORE.has(c);

/**
 * How to render a mother's own language: her pack if one exists and has translations, else plain
 * English with a visible note. `languageTag` (BCP-47) wins over `language` (pack code).
 */
export function motherLanguageInfo(m: { language?: string; languageTag?: string }): { tag: string; render: PackCode; packCode?: PackCode; pack: PackState; note?: string } {
  const tag = m.languageTag || m.language || 'en';
  const packCode = packFor(tag);
  const pack = packStateFor(tag);
  if (packCode && (pack !== 'none' || packCode === 'en')) return { tag, render: packCode, packCode, pack };
  return { tag, render: 'en', ...(packCode ? { packCode } : {}), pack: 'none', note: NO_PACK_NOTE };
}
