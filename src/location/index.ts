/**
 * Location profiles: what is grown, eaten, practised and available near a worker,
 * so plans say "2 oranges a day" in Benue rather than "250 mg vitamin C".
 *
 * Exports:
 * - getLocationProfile(country, region): curated profile, or a country default built from national data
 * - listRegions(country), nearestRegion(lat, lon), withDistances(profile, lat, lon)
 * - toPlanLocation(profile): the PlanContext.location shape the engine reads
 * - buildLocationProfile(input, opts): the live pipeline (open datasets, cached); offline it returns the curated profile
 * - OPEN_DATASETS: the dataset URLs the pipeline uses
 * - saveLocationProfile / loadSavedLocationProfile: remember the chosen profile on this device
 */
import type { CountryCode, LanguageCode } from '../types';
import { COUNTRY_RULES, LOCAL_FOODS, TRADITIONAL_PRACTICES } from '../clinical';
import { countryName as geoCountryName, findRegion as geoFindRegion, getCountry } from '../geo/places';
import { languagesFor } from '../geo/languages';
import { MALARIA_SOURCES, malariaDefault } from '../geo/malaria';
import { LOCATION_PROFILES } from './profiles';
import { LOCATION_SOURCES, src } from './sources';
import type { LocationFood, LocationProfile, PlanLocation, ReferralFacility } from './types';

export type { LocationProfile, LocationFood, ReferralFacility, PlanLocation, MalariaRisk, FacilityType, CostTier } from './types';
export { LOCATION_PROFILES, LOCATION_SOURCES };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(state|county|region)\b/g, '')
    .replace(/[^a-z]/g, '');

/** Alternative names people type: 'FCT', 'Calabar', 'Akwa' are not handled; only regions with profiles. */
const ALIASES: Record<string, string> = {
  crossriver: 'Cross River',
  calabar: 'Cross River',
  makurdi: 'Benue',
  ibadan: 'Oyo',
  benincity: 'Edo',
  asaba: 'Delta',
  maiduguri: 'Borno',
  ikeja: 'Lagos',
  accra: 'Greater Accra',
  greateraccra: 'Greater Accra',
  kumasi: 'Ashanti',
  tamale: 'Northern',
  bolgatanga: 'Upper East',
  bolga: 'Upper East',
  uppereast: 'Upper East',
  lodwar: 'Turkana',
};

const COUNTRY_NAMES: Record<CountryCode, string> = { NG: 'Nigeria', KE: 'Kenya', GH: 'Ghana' };

/** Default languages per country when no curated profile exists */
const COUNTRY_LANGS: Record<CountryCode, LanguageCode[]> = {
  NG: ['en', 'pcm', 'ha', 'yo', 'ig'],
  KE: ['sw', 'en'],
  GH: ['en', 'tw'],
};

/** Regions with a curated profile (Nigeria, Kenya, Ghana). For every region of any country use src/geo listRegions. */
export function listRegions(country: CountryCode | string): string[] {
  return LOCATION_PROFILES.filter((p) => p.country === country).map((p) => p.region);
}

function findCurated(country: CountryCode, region: string): LocationProfile | undefined {
  const n = norm(region);
  const target = ALIASES[n] ? norm(ALIASES[n]) : n;
  return LOCATION_PROFILES.find((p) => p.country === country && norm(p.region) === target);
}

/**
 * A profile for any region of a supported country, built from national lists:
 * national foods (cheap first), every practice the library lists for the country,
 * and the national IPTp policy. No facilities: those need a live lookup or local knowledge.
 */
export function countryDefaultProfile(country: CountryCode, region: string): LocationProfile {
  const rules = COUNTRY_RULES[country];
  const endemic = rules.iptp === 'all' || (rules.iptpRegions ?? []).some((r) => norm(r) === norm(region));
  const foods: LocationFood[] = LOCAL_FOODS[country]
    .filter((f) => f.costTier === 'cheap')
    .slice(0, 6)
    .map((f) => ({
      name: f.name,
      nutrients: f.nutrients,
      householdMeasure: f.serving ?? 'a portion',
      season: 'all year',
      costTier: f.costTier,
      why: 'Cheap and widely sold across the country.',
      sourceIds: ['gaskin-local-foods'],
    }));
  return {
    id: `${country}-${norm(region) || 'unknown'}`,
    country,
    region: region || COUNTRY_NAMES[country],
    regionKind: country === 'NG' ? 'state' : country === 'KE' ? 'county' : 'region',
    capital: '',
    centroid: [0, 0],
    languages: COUNTRY_LANGS[country],
    otherLanguages: [],
    localFoods: foods,
    seasonality: 'No local harvest calendar yet. Ask mothers which foods are cheap this month.',
    prevalentPractices: TRADITIONAL_PRACTICES.filter((p) => p.countries.includes(country))
      .slice(0, 6)
      .map((p) => p.id),
    malariaEndemic: endemic,
    malariaRisk: endemic ? 'moderate' : 'low',
    malariaNote: endemic ? 'National policy gives IPTp here.' : 'Not in an IPTp zone under national policy; test any fever promptly.',
    referralFacilities: [],
    connectivityNote: 'No local connectivity data yet.',
    sources: src('gaskin-local-foods', 'gaskin-trad-library'),
    reviewedAt: '2026-11-05',
    origin: 'country_default',
  };
}

const isLaunch = (c: string): c is CountryCode => c === 'NG' || c === 'KE' || c === 'GH';

/**
 * A profile for a country (or region) with no curated data: no local food claims, no practices,
 * no facilities; WHO defaults, and malaria from the WHO World Malaria Report country list.
 * Languages come from src/geo (CLDR plus curated regions), mapped to Gaskin packs where they exist.
 * Never borrows another country's foods, practices or languages.
 */
export function genericProfile(country: string, region = ''): LocationProfile {
  const cc = (country || '').toUpperCase();
  const reg = geoFindRegion(cc, region);
  const langs = languagesFor(cc, region);
  const malaria = malariaDefault(cc);
  const name = geoCountryName(cc) || cc || 'your country';
  return {
    id: `${cc || 'XX'}-${norm(reg?.name ?? region) || 'generic'}`,
    country: cc as CountryCode,
    region: reg?.name ?? (region || name),
    regionKind: 'region',
    capital: '',
    centroid: [0, 0],
    languages: langs.filter((l) => l.packCode && l.pack !== 'none').map((l) => l.packCode as LanguageCode),
    otherLanguages: langs.filter((l) => !l.packCode || l.pack === 'none').map((l) => l.name),
    localFoods: [],
    seasonality: 'No local food data for this area yet. Ask her which iron-rich and protein foods are cheap this month.',
    prevalentPractices: [],
    malariaEndemic: malaria.iptp,
    malariaRisk: malaria.risk,
    malariaNote: malaria.note,
    referralFacilities: [],
    connectivityNote: 'No local connectivity data yet.',
    sources: MALARIA_SOURCES,
    reviewedAt: '2026-11-06',
    origin: 'generic',
  };
}

/**
 * Curated profile for a region; a country default for the launch countries (Nigeria, Kenya, Ghana);
 * otherwise a generic WHO-default profile for that country. Never falls back to another country. Never throws.
 */
export function getLocationProfile(country: CountryCode | string, region: string): LocationProfile {
  const cc = String(country ?? '').toUpperCase();
  if (isLaunch(cc)) return findCurated(cc, region ?? '') ?? countryDefaultProfile(cc, region ?? '');
  return genericProfile(cc, region ?? '');
}

/** Whether Gaskin has a hand-checked profile for this region */
export function hasCuratedProfile(country: CountryCode | string, region: string): boolean {
  const cc = String(country ?? '').toUpperCase();
  return isLaunch(cc) && Boolean(findCurated(cc, region));
}

/** Whether a country is known to Gaskin's geography data (ISO 3166-1) */
export function isKnownCountry(country: string | undefined): boolean {
  return Boolean(getCountry(country));
}

/** Great-circle distance in kilometres */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Best guess of region from a GPS fix: the curated region whose capital is nearest.
 * Rough (capitals, not borders), so the wizard always asks the worker to confirm.
 * Returns null more than 400 km from any known capital (e.g. a worker outside the launch countries).
 */
export function nearestRegion(lat: number, lon: number): { country: CountryCode; region: string; km: number } | null {
  let best: { country: CountryCode; region: string; km: number } | null = null;
  for (const p of LOCATION_PROFILES) {
    const km = haversineKm([lat, lon], p.centroid);
    if (!best || km < best.km) best = { country: p.country, region: p.region, km };
  }
  return best && best.km <= 400 ? { ...best, km: Math.round(best.km) } : null;
}

/** Fill straight-line distances to referral facilities from the worker's position, nearest first */
export function withDistances(profile: LocationProfile, lat: number, lon: number): LocationProfile {
  const facilities: ReferralFacility[] = profile.referralFacilities
    .map((f) => ({ ...f, distanceKm: f.townLatLon ? Math.round(haversineKm([lat, lon], f.townLatLon)) : f.distanceKm }))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  return { ...profile, referralFacilities: facilities };
}

/** The engine hook: PlanContext.location */
export function toPlanLocation(p: LocationProfile): PlanLocation {
  return {
    country: p.country,
    region: p.region,
    localFoods: p.localFoods.map((f) => ({ name: f.name, nutrients: f.nutrients, season: f.season, costTier: f.costTier })),
    practices: p.prevalentPractices,
    malariaEndemic: p.malariaEndemic,
  };
}

// ---------------------------------------------------------------------------
// Live pipeline
// ---------------------------------------------------------------------------

/**
 * Open datasets a live build would read at setup. Nothing here is fetched by default:
 * Gaskin must work offline, and the hosted demo runs in a sandbox that blocks most requests.
 * See docs/location-data.md for the full description.
 */
export const OPEN_DATASETS = {
  /** OpenStreetMap health facilities via healthsites.io (API key needed for v3) */
  healthsites: 'https://healthsites.io/api/v3/facilities/?country={iso3}&extent={bbox}&flat-properties=true&api-key={key}',
  /** OpenStreetMap through Overpass: hospitals and clinics in a radius of the worker */
  overpass: 'https://overpass-api.de/api/interpreter?data=[out:json];(node[amenity~"hospital|clinic"](around:{radiusM},{lat},{lon});way[amenity~"hospital|clinic"](around:{radiusM},{lat},{lon}););out center 50;',
  /** GRID3 health facility and settlement layers (Nigeria first, also Kenya and Ghana) */
  grid3: 'https://data.grid3.org/',
  /** Malaria Atlas Project: Plasmodium falciparum parasite rate rasters and admin-1 summaries */
  malariaAtlas: 'https://data.malariaatlas.org/',
  /** FAOSTAT production by country and crop (QCL domain), for national crop lists */
  faostat: 'https://faostatservices.fao.org/api/v1/en/data/QCL?area={faoArea}&element=5510&year={year}',
  /** FAO GIEWS country briefs: lean season and harvest calendar */
  giews: 'https://www.fao.org/giews/countrybrief/country.jsp?code={iso3}',
  /** geoBoundaries admin-1 and admin-2 boundaries, for point-in-polygon region lookup */
  geoBoundaries: 'https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM2/',
  /** Ethnologue-free alternative for languages: Glottolog languoids with coordinates */
  glottolog: 'https://glottolog.org/resource/languoid/id/{glottocode}.json',
} as const;

const ISO3: Record<CountryCode, string> = { NG: 'NGA', KE: 'KEN', GH: 'GHA' };
const CACHE_KEY = 'gaskin.location.cache.v1';
const SAVED_KEY = 'gaskin.location.profile.v1';

export interface BuildInput {
  country: CountryCode | string;
  region: string;
  district?: string;
  lat?: number;
  lon?: number;
}

export interface BuildOptions {
  /** Try open datasets over the network. Default false: setup must never wait on the network. */
  online?: boolean;
  /** Injected fetch (tests, or a proxy) */
  fetchImpl?: typeof fetch;
  /** Radius for the facility search, km. Default 60. */
  radiusKm?: number;
  /** Give up on each request after this many ms. Default 8000. */
  timeoutMs?: number;
}

function readCache(): Record<string, LocationProfile> {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocationProfile>) : {};
  } catch {
    return {};
  }
}

function writeCache(key: string, p: LocationProfile): void {
  try {
    const all = readCache();
    all[key] = p;
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the profile still works for this session */
  }
}

/** Nearby hospitals from OpenStreetMap (Overpass). Returns [] on any failure. */
async function fetchOsmFacilities(lat: number, lon: number, opts: Required<Pick<BuildOptions, 'radiusKm' | 'timeoutMs'>> & { fetchImpl: typeof fetch }): Promise<ReferralFacility[]> {
  const url = OPEN_DATASETS.overpass
    .replaceAll('{radiusM}', String(opts.radiusKm * 1000))
    .replaceAll('{lat}', String(lat))
    .replaceAll('{lon}', String(lon));
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctrl?.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchImpl(url, { signal: ctrl?.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { elements?: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
    return (json.elements ?? [])
      .filter((e) => e.tags?.name && e.tags.amenity === 'hospital')
      .map((e) => {
        const pos: [number, number] | undefined = e.lat !== undefined && e.lon !== undefined ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : undefined;
        const name = e.tags!.name!;
        const type: ReferralFacility['type'] = /teaching/i.test(name) ? 'teaching_hospital' : /federal medical/i.test(name) ? 'federal_medical_centre' : /referral/i.test(name) ? 'county_referral_hospital' : /regional/i.test(name) ? 'regional_hospital' : /maternity/i.test(name) ? 'maternity_hospital' : 'general_hospital';
        return {
          name,
          type,
          town: e.tags!['addr:city'] ?? '',
          townLatLon: pos,
          distanceKm: pos ? Math.round(haversineKm([lat, lon], pos)) : null,
          note: 'From OpenStreetMap; confirm it offers emergency obstetric care before relying on it.',
          sourceIds: ['osm-overpass'],
        };
      })
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
      .slice(0, 5);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the location profile for setup.
 *
 * Offline (the default) it returns the curated profile, or the country default, plus
 * straight-line facility distances when the worker shared her position. This is instant.
 *
 * With `online: true` it would, in order (each step optional, each failure ignored):
 * 1. Resolve region and district from GPS with geoBoundaries ADM1/ADM2 polygons.
 * 2. Ask OpenStreetMap (Overpass, or healthsites.io with a key) for hospitals within `radiusKm`,
 *    and add those that are not already listed. Only named hospitals are kept, and each is marked
 *    "confirm it offers emergency obstetric care". GRID3 is the preferred source in Nigeria once a
 *    static extract is bundled (its download portal is not a JSON API).
 * 3. Read the Malaria Atlas Project admin-1 parasite rate to set malariaRisk (never malariaEndemic,
 *    which follows national IPTp policy).
 * 4. Read FAOSTAT and GIEWS for the national crop list and lean season, to fill the seasonality line
 *    for regions with no curated profile.
 * 5. Cache the result in browser storage under `gaskin.location.cache.v1`, keyed country/region/district,
 *    so the next start is offline.
 * Only step 2 is implemented here; the others are described in docs/location-data.md.
 */
export async function buildLocationProfile(input: BuildInput, opts: BuildOptions = {}): Promise<LocationProfile> {
  const key = `${input.country}/${norm(input.region)}/${norm(input.district ?? '')}`;
  const cached = readCache()[key];
  let base: LocationProfile = cached ?? getLocationProfile(input.country, input.region);
  if (input.district) base = { ...base, district: input.district };
  const hasPos = typeof input.lat === 'number' && typeof input.lon === 'number';
  if (hasPos) base = withDistances(base, input.lat!, input.lon!);

  const fetchImpl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  if (opts.online && hasPos && fetchImpl && !cached) {
    const osm = await fetchOsmFacilities(input.lat!, input.lon!, { radiusKm: opts.radiusKm ?? 60, timeoutMs: opts.timeoutMs ?? 8000, fetchImpl });
    const known = new Set(base.referralFacilities.map((f) => norm(f.name)));
    const extra = osm.filter((f) => !known.has(norm(f.name)));
    if (extra.length) {
      base = {
        ...base,
        referralFacilities: [...base.referralFacilities, ...extra].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)),
        sources: [...base.sources, { id: 'osm-overpass', label: `OpenStreetMap contributors, via Overpass API (${ISO3[input.country as CountryCode] ?? input.country}), fetched at setup`, url: 'https://www.openstreetmap.org/copyright' }],
        origin: base.origin === 'curated' ? 'curated' : 'generated',
      };
    }
    writeCache(key, base);
  }
  return base;
}

/** Remember the worker's location profile on this device */
export function saveLocationProfile(p: LocationProfile): void {
  try {
    globalThis.localStorage?.setItem(SAVED_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function loadSavedLocationProfile(): LocationProfile | null {
  try {
    const raw = globalThis.localStorage?.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as LocationProfile) : null;
  } catch {
    return null;
  }
}
