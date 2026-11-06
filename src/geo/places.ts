/**
 * Countries, first-level regions and second-level areas, from the bundled open data in ./data
 * (built by scripts/geo/build.mjs; sources in SOURCES.md). Everything works offline.
 *
 * Countries and regions are loaded with the app (about 70 KB). Second-level areas (LGAs,
 * sub-counties, districts, municipalities) are loaded per country on first use with loadAreas().
 */
import COUNTRY_ROWS from './data/countries.json';
import REGION_ROWS from './data/regions.json';

export interface Country {
  /** ISO 3166-1 alpha-2, e.g. 'NG' */
  code: string;
  /** English short name, e.g. 'Nigeria' */
  name: string;
  /** Name in the country's main language, when it differs from the English name */
  nativeName?: string;
  /** International calling code without '+', e.g. '234' */
  callingCode?: string;
  /** ISO 4217 currency, e.g. 'NGN' */
  currency?: string;
  /** Other names people type, e.g. 'Ivory Coast', 'DRC' */
  aliases: string[];
}

export interface Region {
  /** ISO 3166-2 code, e.g. 'NG-LA', 'KE-17', 'ZA-KZN' */
  code: string;
  country: string;
  /** Plain English name, e.g. 'Lagos', 'Kisumu', 'KwaZulu-Natal' */
  name: string;
}

export interface Area {
  name: string;
  /** ISO 3166-2 code of the region it belongs to */
  region: string;
  /** Approximate centre (rounded to 0.01°), when the source gives one. Straight-line use only. */
  lat?: number;
  lon?: number;
}

/** Launch countries, pinned to the top of the country list in this order */
export const PINNED_COUNTRIES = ['NG', 'GH', 'KE'] as const;

/** Countries with bundled second-level areas */
export const AREA_COUNTRIES = ['NG', 'KE', 'GH', 'ZA'] as const;

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

type CountryRow = [string, string, string, string, string, string];

const COUNTRIES: Country[] = (COUNTRY_ROWS as CountryRow[]).map(([code, name, nativeName, callingCode, currency, aliases]) => ({
  code,
  name,
  ...(nativeName ? { nativeName } : {}),
  ...(callingCode ? { callingCode } : {}),
  ...(currency ? { currency } : {}),
  aliases: aliases ? aliases.split(';') : [],
}));
const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Lowercase, strip accents and punctuation, for matching what people type */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Every country: Nigeria, Ghana and Kenya first, then A to Z by English name. */
export function listCountries(): Country[] {
  const pinned = PINNED_COUNTRIES.map((c) => BY_CODE.get(c)!);
  return [...pinned, ...COUNTRIES.filter((c) => !(PINNED_COUNTRIES as readonly string[]).includes(c.code))];
}

export function getCountry(code: string | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export function countryName(code: string | undefined): string {
  return getCountry(code)?.name ?? code ?? '';
}

/**
 * Countries matching what was typed (English, native or other name, or the ISO code),
 * best matches first; pinned countries first for an empty query.
 */
export function searchCountries(query: string, limit = 50): Country[] {
  const q = fold(query);
  if (!q) return listCountries().slice(0, limit);
  const scored: Array<[number, Country]> = [];
  for (const c of listCountries()) {
    const names = [c.name, c.nativeName ?? '', ...c.aliases].map(fold).filter(Boolean);
    let score = -1;
    if (q.length === 2 && c.code.toLowerCase() === q) score = 0;
    else if (names.some((n) => n === q)) score = 1;
    else if (names.some((n) => n.startsWith(q))) score = 2;
    else if (names.some((n) => n.split(' ').some((w) => w.startsWith(q)))) score = 3;
    else if (q.length >= 3 && names.some((n) => n.includes(q))) score = 4;
    if (score >= 0) scored.push([score, c]);
  }
  return scored
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, c]) => c);
}

/** Resolve a typed country name or code (e.g. from 'Another country') to a country. */
export function findCountry(input: string | undefined): Country | undefined {
  if (!input) return undefined;
  const byCode = getCountry(input.trim());
  if (byCode && input.trim().length === 2) return byCode;
  const q = fold(input);
  return COUNTRIES.find((c) => [c.name, c.nativeName ?? '', ...c.aliases].some((n) => fold(n) === q)) ?? searchCountries(input, 1)[0];
}

// ---------------------------------------------------------------------------
// Regions (ISO 3166-2 first level)
// ---------------------------------------------------------------------------

const REGIONS = new Map<string, Region[]>();
for (const [country, packed] of Object.entries(REGION_ROWS as Record<string, string>)) {
  REGIONS.set(
    country,
    packed.split('|').map((s) => {
      const i = s.indexOf(':');
      return { code: `${country}-${s.slice(0, i)}`, country, name: s.slice(i + 1) };
    }),
  );
}

/** Other names for regions: capitals, abbreviations, older names */
const REGION_ALIASES: Record<string, string> = {
  // Nigeria
  fct: 'NG-FC', abuja: 'NG-FC', 'abuja federal capital territory': 'NG-FC', 'federal capital territory': 'NG-FC',
  calabar: 'NG-CR', makurdi: 'NG-BE', ibadan: 'NG-OY', 'benin city': 'NG-ED', asaba: 'NG-DE', maiduguri: 'NG-BO', ikeja: 'NG-LA',
  'port harcourt': 'NG-RI', akwa: 'NG-AK', uyo: 'NG-AK', jos: 'NG-PL', nasarawa: 'NG-NA',
  // Kenya
  'nairobi city': 'KE-30', 'elgeyo marakwet': 'KE-05', 'taita taveta': 'KE-39', muranga: 'KE-29', 'tharaka nithi': 'KE-41', lodwar: 'KE-43',
  // Ghana
  accra: 'GH-AA', kumasi: 'GH-AH', tamale: 'GH-NP', bolgatanga: 'GH-UE', bolga: 'GH-UE', wa: 'GH-UW', ho: 'GH-TV',
  // South Africa
  kzn: 'ZA-KZN', 'kwa zulu natal': 'ZA-KZN', gauteng: 'ZA-GP', johannesburg: 'ZA-GP', 'cape town': 'ZA-WC', durban: 'ZA-KZN', 'north west': 'ZA-NW',
};

const regionFold = (s: string) =>
  fold(s)
    .replace(/\b(state|county|region|province|city county)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** First-level regions of a country (states, counties, regions, provinces), A to Z. Empty if none. */
export function listRegions(country: string | undefined): Region[] {
  return (country && REGIONS.get(country.toUpperCase())) || [];
}

/** Find a region by ISO 3166-2 code, name ('Enugu State', 'kisumu county'), or a common alias ('FCT', 'Bolga'). */
export function findRegion(country: string | undefined, input: string | undefined): Region | undefined {
  if (!country || !input) return undefined;
  const list = listRegions(country);
  const raw = input.trim();
  const upper = raw.toUpperCase();
  const byCode = list.find((r) => r.code === upper || r.code === `${country.toUpperCase()}-${upper}`);
  if (byCode) return byCode;
  const q = regionFold(raw);
  if (!q) return undefined;
  const byName = list.find((r) => regionFold(r.name) === q);
  if (byName) return byName;
  const alias = REGION_ALIASES[fold(raw)] ?? REGION_ALIASES[q];
  return alias ? list.find((r) => r.code === alias) : undefined;
}

export function searchRegions(country: string | undefined, query: string): Region[] {
  const q = regionFold(query);
  const list = listRegions(country);
  if (!q) return list;
  return list.filter((r) => regionFold(r.name).split(' ').some((w) => w.startsWith(q)) || regionFold(r.name).startsWith(q));
}

/** What a country calls its regions and areas, for labels */
export interface PlaceWords {
  /** 'State', 'County', 'Region', 'Province', or 'State, province or region' */
  region: string;
  /** 'Local government area (LGA)', 'Sub-county', 'District', 'Municipality', 'District or local area' */
  area: string;
  /** Short form, e.g. 'LGA' */
  areaShort: string;
}

const WORDS: Record<string, PlaceWords> = {
  NG: { region: 'State', area: 'Local government area (LGA)', areaShort: 'LGA' },
  KE: { region: 'County', area: 'Sub-county', areaShort: 'Sub-county' },
  GH: { region: 'Region', area: 'District', areaShort: 'District' },
  ZA: { region: 'Province', area: 'Municipality', areaShort: 'Municipality' },
  UG: { region: 'District', area: 'Sub-county', areaShort: 'Sub-county' },
  TZ: { region: 'Region', area: 'District', areaShort: 'District' },
  ET: { region: 'Region', area: 'Zone or woreda', areaShort: 'Woreda' },
  CM: { region: 'Region', area: 'Department', areaShort: 'Department' },
  CA: { region: 'Province or territory', area: 'District or local area', areaShort: 'Area' },
  US: { region: 'State', area: 'County', areaShort: 'County' },
  IN: { region: 'State', area: 'District', areaShort: 'District' },
};

export function placeWords(country: string | undefined): PlaceWords {
  return WORDS[(country ?? '').toUpperCase()] ?? { region: 'State, province or region', area: 'District or local area', areaShort: 'Area' };
}

// ---------------------------------------------------------------------------
// Areas (second level), loaded per country
// ---------------------------------------------------------------------------

const AREA_LOADERS: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  NG: () => import('./data/areas/NG.json'),
  KE: () => import('./data/areas/KE.json'),
  GH: () => import('./data/areas/GH.json'),
  ZA: () => import('./data/areas/ZA.json'),
};

const AREAS = new Map<string, Map<string, Area[]>>();

function unpackAreas(country: string, packed: Record<string, string>): Map<string, Area[]> {
  const out = new Map<string, Area[]>();
  for (const [suffix, list] of Object.entries(packed)) {
    const region = `${country}-${suffix}`;
    out.set(
      region,
      list.split('|').map((s) => {
        const [name, at] = s.split('@');
        if (!at) return { name, region };
        const [lat, lon] = at.split(',').map(Number);
        return { name, region, lat, lon };
      }),
    );
  }
  return out;
}

/** Whether Gaskin has a list of second-level areas for this country (otherwise: free text) */
export function hasAreaData(country: string | undefined): boolean {
  return Boolean(country && AREA_LOADERS[country.toUpperCase()]);
}

/**
 * Areas for a region (or the whole country when region is omitted), A to Z.
 * Resolves to [] where Gaskin has no list: the UI then offers free text.
 */
export async function loadAreas(country: string | undefined, region?: string): Promise<Area[]> {
  const c = (country ?? '').toUpperCase();
  const load = AREA_LOADERS[c];
  if (!load) return [];
  if (!AREAS.has(c)) AREAS.set(c, unpackAreas(c, (await load()).default));
  return listAreasSync(c, region) ?? [];
}

/** Same as loadAreas, but synchronous: null until loadAreas(country) has resolved once. */
export function listAreasSync(country: string | undefined, region?: string): Area[] | null {
  const c = (country ?? '').toUpperCase();
  const all = AREAS.get(c);
  if (!all) return hasAreaData(c) ? null : [];
  if (!region) return [...all.values()].flat();
  const r = findRegion(c, region);
  return r ? (all.get(r.code) ?? []) : [];
}

/** Find an area by name within a region (loose match). Needs loadAreas first; otherwise undefined. */
export function findArea(country: string | undefined, region: string | undefined, input: string | undefined): Area | undefined {
  if (!input) return undefined;
  const q = fold(input).replace(/\b(lga|local government|sub county|district|municipal|municipality|metropolitan|local municipality)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const list = listAreasSync(country, region) ?? [];
  const key = (n: string) =>
    fold(n)
      .replace(/\b(lga|local government|sub county|district|municipal|municipality|metropolitan|local municipality)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return list.find((a) => key(a.name) === q);
}
