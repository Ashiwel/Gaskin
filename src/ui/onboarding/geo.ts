/**
 * Thin adapter over src/geo (countries, regions, districts, languages for a place) and src/legal
 * (emergency numbers, disclaimers, consent). src/geo is being built in parallel: when it exists its
 * exports are used; until then this file supplies a small, honest fallback so onboarding and
 * Settings work. The fallback never offers a language from another country: a place's
 * languages come only from that place's own list, else English.
 */
import { useEffect, useState } from 'react';
import type { CountryCode } from '../../types';
import { LANGUAGE_NAMES } from '../../data';
import { getLocationProfile, listRegions as curatedRegions } from '../../location';
import { REGION_LANGUAGE, isPackCode, getPack } from '../../i18n';
import { CONSENT_KEYS, CONSENT_VERSION, DISCLAIMER_KEYS, TERMS_KEYS, consentValid, emergencyNumberFor, renderLegal, type PersonalConsent } from '../../legal';

// ---------------------------------------------------------------------------
// Optional modules, picked up at build time when they exist
// ---------------------------------------------------------------------------

type Mod = Record<string, unknown>;
const GEO: Mod = Object.assign({}, ...Object.values(import.meta.glob(['../../geo/places.ts', '../../geo/index.ts'], { eager: true })) as Mod[]);

function pick<T = unknown>(mod: Mod, names: string[]): T | undefined {
  for (const n of names) if (mod[n] !== undefined) return mod[n] as T;
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...a: any[]) => unknown;
function call(mod: Mod, names: string[], ...args: unknown[]): unknown {
  const f = pick<AnyFn>(mod, names);
  if (typeof f !== 'function') return undefined;
  try {
    return f(...args);
  } catch {
    return undefined;
  }
}

export const geoModuleReady = Object.keys(GEO).length > 0;

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

export interface GeoCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** Launch countries with curated data */
  launch: boolean;
}

/** Shown first, in this order (founder's request). */
export const PINNED: string[] = ['NG', 'GH', 'KE'];

const ISO =
  'AF AX AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BR VG BN BG BF BI CV KH CM CA KY CF TD CL CN CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU KP MK MP NO OM PK PW PS PA PG PY PE PH PL PT PR QA RE RO RU RW WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA KR SS ES LK BL SH KN LC MF PM VC SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TC TV UG UA AE GB US UY UZ VU VA VE VN WF EH YE ZM ZW'.split(' ');

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

let countryCache: GeoCountry[] | null = null;

/** Every country: Nigeria, Ghana and Kenya first, then A to Z. */
export function listCountries(): GeoCountry[] {
  if (countryCache) return countryCache;
  const raw = call(GEO, ['listCountries', 'allCountries', 'getCountries']) ?? pick(GEO, ['COUNTRIES', 'COUNTRY_LIST', 'ALL_COUNTRIES']);
  let list: GeoCountry[] = [];
  if (Array.isArray(raw)) {
    list = raw
      .map((c) => {
        if (typeof c === 'string') return { code: c, name: regionName(c), launch: PINNED.includes(c) };
        const o = c as Record<string, unknown>;
        const code = String(o.code ?? o.iso2 ?? o.id ?? '');
        return { code, name: String(o.name ?? o.label ?? regionName(code)), launch: PINNED.includes(code) };
      })
      .filter((c) => c.code);
  } else if (raw && typeof raw === 'object') {
    list = Object.entries(raw as Record<string, unknown>).map(([code, v]) => ({
      code,
      name: String((v as Record<string, unknown>)?.name ?? regionName(code)),
      launch: PINNED.includes(code),
    }));
  }
  if (list.length < 100) list = ISO.map((code) => ({ code, name: regionName(code), launch: PINNED.includes(code) }));
  const pinned = PINNED.map((p) => list.find((c) => c.code === p)).filter((c): c is GeoCountry => Boolean(c));
  const rest = list.filter((c) => !PINNED.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
  countryCache = [...pinned, ...rest];
  return countryCache;
}

/** ISO 4217 currency for a country, from src/geo when it knows it. */
export function countryCurrency(code?: string): string | undefined {
  const c = call(GEO, ['getCountry'], code) as { currency?: string } | undefined;
  return c?.currency;
}

export function countryName(code?: string): string {
  if (!code) return '';
  return listCountries().find((c) => c.code === code)?.name ?? regionName(code);
}

export const isLaunch = (code?: string): code is CountryCode => code === 'NG' || code === 'KE' || code === 'GH';

/** Flag emoji from the ISO code (regional indicator letters). */
export function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// ---------------------------------------------------------------------------
// Regions and districts
// ---------------------------------------------------------------------------

function names(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (typeof r === 'string' ? r : String((r as Record<string, unknown>)?.name ?? (r as Record<string, unknown>)?.label ?? '')))
    .filter(Boolean);
}

const NG_STATES =
  'Abia,Adamawa,Akwa Ibom,Anambra,Bauchi,Bayelsa,Benue,Borno,Cross River,Delta,Ebonyi,Edo,Ekiti,Enugu,Federal Capital Territory,Gombe,Imo,Jigawa,Kaduna,Kano,Katsina,Kebbi,Kogi,Kwara,Lagos,Nasarawa,Niger,Ogun,Ondo,Osun,Oyo,Plateau,Rivers,Sokoto,Taraba,Yobe,Zamfara'.split(',');
const KE_COUNTIES =
  'Baringo,Bomet,Bungoma,Busia,Elgeyo-Marakwet,Embu,Garissa,Homa Bay,Isiolo,Kajiado,Kakamega,Kericho,Kiambu,Kilifi,Kirinyaga,Kisii,Kisumu,Kitui,Kwale,Laikipia,Lamu,Machakos,Makueni,Mandera,Marsabit,Meru,Migori,Mombasa,Murang’a,Nairobi,Nakuru,Nandi,Narok,Nyamira,Nyandarua,Nyeri,Samburu,Siaya,Taita-Taveta,Tana River,Tharaka-Nithi,Trans Nzoia,Turkana,Uasin Gishu,Vihiga,Wajir,West Pokot'.split(',');
const GH_REGIONS = 'Ahafo,Ashanti,Bono,Bono East,Central,Eastern,Greater Accra,North East,Northern,Oti,Savannah,Upper East,Upper West,Volta,Western,Western North'.split(',');
const FALLBACK_REGIONS: Record<string, string[]> = { NG: NG_STATES, KE: KE_COUNTIES, GH: GH_REGIONS };

/** States, counties, regions or provinces for a country; empty when Gaskin has no list (type it instead). */
export function listRegionsFor(country?: string): string[] {
  if (!country) return [];
  const real = names(call(GEO, ['listRegions', 'regionsFor', 'regionsOf', 'getRegions'], country));
  if (real.length) return real;
  const base = FALLBACK_REGIONS[country] ?? [];
  const curated = isLaunch(country) ? curatedRegions(country) : [];
  return [...new Set([...base, ...curated])].sort((a, b) => a.localeCompare(b, 'en-GB'));
}

/** LGAs, sub-counties or districts; empty when Gaskin has no list (type it instead) or not loaded yet. */
export function listDistrictsFor(country?: string, region?: string): string[] {
  if (!country || !region) return [];
  return names(call(GEO, ['listAreasSync', 'listDistricts', 'districtsFor', 'getDistricts'], country, region));
}

/** Load the area list for a country (bundled, loaded on first use). Resolves when ready. */
export async function loadDistricts(country?: string, region?: string): Promise<string[]> {
  if (!country || !region) return [];
  const f = pick<AnyFn>(GEO, ['loadAreas']);
  if (typeof f !== 'function') return listDistrictsFor(country, region);
  try {
    return names(await f(country, region));
  } catch {
    return [];
  }
}

/** Districts for a region, re-rendering once the country's list has loaded. */
export function useDistricts(country?: string, region?: string): string[] {
  const [list, setList] = useState<string[]>(() => listDistrictsFor(country, region));
  useEffect(() => {
    let live = true;
    setList(listDistrictsFor(country, region));
    void loadDistricts(country, region).then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, [country, region]);
  return list;
}

const REGION_WORD: Record<string, [string, string]> = {
  NG: ['State', 'Local government area'],
  KE: ['County', 'Sub-county'],
  GH: ['Region', 'District'],
  ZA: ['Province', 'District or municipality'],
  US: ['State', 'County'],
  CA: ['Province', 'Region'],
  UG: ['Region', 'District'],
  TZ: ['Region', 'District'],
};

export function regionWords(country?: string): { region: string; district: string } {
  const real = call(GEO, ['placeWords', 'regionLabels', 'adminLabels'], country) as { region?: string; district?: string; area?: string } | undefined;
  const [r, d] = REGION_WORD[country ?? ''] ?? ['State, province or region', 'District'];
  return { region: real?.region ?? r, district: real?.area ?? real?.district ?? d };
}

// ---------------------------------------------------------------------------
// Languages for a place
// ---------------------------------------------------------------------------

export interface PlaceLanguage {
  code: string;
  name: string;
  nativeName: string;
  /** Gaskin has a language pack for it */
  hasPack: boolean;
  /** 'reviewed' | 'machine_draft' | 'partial' | 'none' when a pack exists */
  status?: string;
}

/** Fallback only: national languages by country, most spoken first. Never borrowed across borders. */
const COUNTRY_LANGS: Record<string, string[]> = {
  NG: ['en', 'ha', 'yo', 'ig', 'pcm', 'ff', 'bin', 'urh', 'ar'],
  KE: ['sw', 'en', 'luo', 'ki'],
  GH: ['en', 'tw', 'ee', 'dag', 'ha'],
  ZA: ['zu', 'xh', 'af', 'en', 'nso', 'tn', 'st'],
  UG: ['en', 'lg', 'sw'],
  TZ: ['sw', 'en'],
  RW: ['rw', 'fr', 'en', 'sw'],
  BI: ['rn', 'fr'],
  CD: ['fr', 'ln', 'sw'],
  CG: ['fr', 'ln'],
  MW: ['ny', 'en'],
  ZM: ['en', 'bem', 'ny'],
  ZW: ['sn', 'nd', 'en'],
  BW: ['tn', 'en'],
  LS: ['st', 'en'],
  MZ: ['pt'],
  AO: ['pt'],
  ET: ['am', 'om'],
  SN: ['fr', 'wo'],
  CI: ['fr'],
  CM: ['fr', 'en'],
  NE: ['fr', 'ha'],
  BF: ['fr'],
  ML: ['fr', 'bm'],
  BJ: ['fr', 'yo'],
  TG: ['fr', 'ee'],
  FR: ['fr'],
  CN: ['zh'],
  BR: ['pt'],
  PT: ['pt'],
};

const FRANCOPHONE = new Set(['SN', 'CI', 'CM', 'NE', 'BF', 'ML', 'BJ', 'TG', 'GN', 'GA', 'TD', 'CF', 'MG', 'DJ', 'CD', 'CG', 'BI', 'RW', 'HT', 'FR', 'BE', 'CH', 'LU', 'MC']);

export function languageName(code: string, inOwn = false): string {
  if (isPackCode(code)) {
    const p = getPack(code);
    return inOwn ? p.nativeName : p.name;
  }
  const known = (LANGUAGE_NAMES as Record<string, string>)[code];
  if (known && !inOwn) return known;
  try {
    return new Intl.DisplayNames([inOwn ? code : 'en-GB'], { type: 'language' }).of(code) ?? known ?? code;
  } catch {
    return known ?? code;
  }
}

export function describeLanguage(code: string): PlaceLanguage {
  const pack = isPackCode(code) ? getPack(code) : null;
  return {
    code,
    name: languageName(code),
    nativeName: languageName(code, true),
    hasPack: Boolean(pack && pack.status !== 'none'),
    status: pack?.status,
  };
}

function codes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (typeof x === 'string' ? x : String((x as Record<string, unknown>)?.code ?? ''))).filter(Boolean);
}

/**
 * Languages spoken at a place, most likely first. Uses src/geo's languagesFor() when it exists;
 * otherwise the region's main language, the curated location profile, then the country's list.
 * A place outside Gaskin's lists gets English (and French in francophone countries), never another
 * country's languages.
 */
export function languagesFor(place: { country?: string; region?: string; district?: string }): PlaceLanguage[] {
  const country = place.country;
  if (!country) return [describeLanguage('en')];
  let out: string[] = [];
  const f = pick<AnyFn>(GEO, ['languagesFor']);
  if (typeof f === 'function') {
    try {
      out = codes(f({ country, region: place.region, district: place.district }));
    } catch {
      out = [];
    }
    if (!out.length) {
      try {
        out = codes(f(country, place.region, place.district));
      } catch {
        out = [];
      }
    }
  }
  if (!out.length) {
    const fromRegion = place.region ? REGION_LANGUAGE[place.region] : undefined;
    const profile = isLaunch(country) && place.region ? getLocationProfile(country, place.region) : null;
    out = [...(fromRegion && isLaunch(country) ? [fromRegion] : []), ...(profile?.languages ?? []), ...(COUNTRY_LANGS[country] ?? [])];
    if (!out.length) out = FRANCOPHONE.has(country) ? ['fr', 'en'] : ['en'];
  }
  return [...new Set(out)].map(describeLanguage);
}

/** Languages used across borders, offered everywhere in the "More languages" sheet. */
export const GLOBAL_LANGS = ['en', 'fr', 'pt', 'ar', 'sw', 'zh'];

/** The "More languages" sheet: this place's languages first, then widely shared ones. */
export function allLanguages(place: { country?: string; region?: string }): PlaceLanguage[] {
  const local = place.country ? languagesFor({ country: place.country }).map((l) => l.code) : [];
  const here = languagesFor(place).map((l) => l.code);
  // Beyond the place's own languages, only widely shared ones: a country's local languages never
  // appear for another country.
  const pool = [...here, ...local, ...GLOBAL_LANGS];
  return [...new Set(pool)].map(describeLanguage);
}

// ---------------------------------------------------------------------------
// Emergency numbers and legal text (src/legal)
// ---------------------------------------------------------------------------

const EMERGENCY: Record<string, string> = { UG: '112', TZ: '112', US: '911', CA: '911', GB: '999 or 112', IN: '112' };

/** The number to call in an emergency in this country, as src/legal states it. */
export function emergencyFor(country?: string): { number: string; label: string; verified: boolean } {
  const verified = country ? emergencyNumberFor(country) : undefined;
  if (verified) return { number: verified, label: 'Emergency', verified: true };
  return { number: EMERGENCY[country ?? ''] ?? '112', label: 'Emergency', verified: false };
}

/** The first number only, for a tel: link. */
export function dialable(n: string): string {
  return (n.match(/[+\d]+/) ?? ['112'])[0];
}

export interface Disclaimer {
  id: string;
  text: string;
}

/** Disclaimers for personal use, in plain words, with her country's emergency number. */
export function personalDisclaimers(country?: string): Disclaimer[] {
  const number = emergencyFor(country).number;
  return DISCLAIMER_KEYS.map((k) => ({ id: k, text: renderLegal(k, { number }) }));
}

export function termsLines(): string[] {
  return TERMS_KEYS.map((k) => renderLegal(k));
}

export function consentLines(country?: string): Array<{ key: string; text: string; required: boolean }> {
  const number = emergencyFor(country).number;
  return CONSENT_KEYS.map((k) => ({ key: k, text: renderLegal(k, { number }), required: k !== 'legal.consent.ai' }));
}

/** The one-line footer for personal mode. */
export function footerDisclaimer(): string {
  return renderLegal('legal.disclaimer.not_doctor');
}

export const CONSENT_STORE_KEY = 'gaskin.personal-consent.v1';

export function saveConsent(c: PersonalConsent): void {
  try {
    globalThis.localStorage?.setItem(CONSENT_STORE_KEY, JSON.stringify(c));
  } catch {
    /* kept with the setup answers too */
  }
}

export function loadConsent(): PersonalConsent | null {
  try {
    const raw = globalThis.localStorage?.getItem(CONSENT_STORE_KEY);
    return raw ? (JSON.parse(raw) as PersonalConsent) : null;
  } catch {
    return null;
  }
}

export { CONSENT_VERSION, consentValid, renderLegal, type PersonalConsent };
