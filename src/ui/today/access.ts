/**
 * Adapters to the shared modules these screens lean on: src/auth (who is acting, what she may
 * see), src/legal (emergency numbers) and src/geo (places and languages). src/geo is loaded with
 * import.meta.glob, which resolves to nothing while the module is absent, so the screens build and
 * run before it lands and pick it up as soon as its index.ts exists.
 */
import { useSyncExternalStore } from 'react';
import type { CountryCode, LanguageCode, Mother, Worker } from '../../types';
import { COUNTRIES, LANGUAGE_NAMES } from '../../data';
import { listRegions } from '../../location';
import { isPackCode, REGION_LANGUAGE } from '../../i18n';
import { useSetup } from '../../setup';
import { can as authCan, profileFromWorker, type Action, type WorkerProfile } from '../../auth';
// The accounts adapter owns the persistent auth store (its storage and demo profiles); read through it.
import { accountsStore, currentProfile, getProfile, listProfiles } from '../accounts/auth';
import { EMERGENCY_NUMBERS, emergencyNumberFor as legalEmergency } from '../../legal';

type AnyMod = Record<string, unknown>;
const pick = (mods: Record<string, unknown>): AnyMod | undefined => Object.values(mods)[0] as AnyMod | undefined;
const geoMod = pick(import.meta.glob('../../geo/index.ts', { eager: true })) ?? pick(import.meta.glob('../../geo/places.ts', { eager: true }));
const geoLangs = pick(import.meta.glob('../../geo/data/languages.json', { eager: true, import: 'default' })) as
  | { territories?: Record<string, string>; names?: Record<string, string[]> }
  | undefined;

// ---------- Permissions ----------

/** What these screens ask about, mapped to src/auth actions. */
export type ScreenAction = 'mothers.view_facility' | 'mothers.register' | 'visits.start';
const ACTION: Record<ScreenAction, Action> = {
  'mothers.view_facility': 'view_facility',
  'mothers.register': 'edit_plan',
  'visits.start': 'edit_plan',
};

/** The acting worker's profile: the one saved on this device, else built from the demo record. */
export function profileOf(worker: Worker | undefined): WorkerProfile | undefined {
  if (!worker) return undefined;
  try {
    const saved = getProfile(worker.id);
    if (saved) return saved;
  } catch {
    /* no auth store yet */
  }
  return profileFromWorker(worker);
}

export function can(worker: Worker | undefined, action: ScreenAction): boolean {
  const p = profileOf(worker);
  if (!p) return true;
  try {
    return authCan(p, ACTION[action]);
  } catch {
    return true;
  }
}

// ---------- Scope: whose mothers a screen shows ----------

/**
 * 'mine' is her own caseload (the default once profiles exist on this device); 'facility' needs
 * view_facility; 'all' is every record on this device, offered only while no worker profiles exist
 * (the shared demo), so a signed-in worker never sees records her role does not allow.
 */
export type Scope = 'mine' | 'facility' | 'all';
const SCOPE_KEY = 'gaskin.caseload.scope.v1';
let scopeListeners: Array<() => void> = [];

export function demoDevice(): boolean {
  try {
    return listProfiles(true).length === 0;
  } catch {
    return true;
  }
}

function readScope(): Scope {
  try {
    const v = globalThis.localStorage?.getItem(SCOPE_KEY);
    if (v === 'mine' || v === 'facility' || v === 'all') return v;
  } catch {
    /* ignore */
  }
  return demoDevice() ? 'all' : 'mine';
}

export function setScope(s: Scope) {
  try {
    globalThis.localStorage?.setItem(SCOPE_KEY, s);
  } catch {
    /* ignore */
  }
  scopeListeners.forEach((f) => f());
}

export function allowedScopes(worker: Worker | undefined): Scope[] {
  const out: Scope[] = ['mine'];
  if (can(worker, 'mothers.view_facility')) out.push('facility');
  if (demoDevice()) out.push('all');
  return out;
}

export function useScope(worker: Worker | undefined): [Scope, (s: Scope) => void] {
  const raw = useSyncExternalStore(
    (fn) => {
      scopeListeners.push(fn);
      return () => {
        scopeListeners = scopeListeners.filter((x) => x !== fn);
      };
    },
    readScope,
    readScope,
  );
  // Re-read when someone signs in, switches or locks, so the caseload follows the signed-in worker.
  useSyncExternalStore(accountsStore.subscribe, accountsStore.getVersion, accountsStore.getVersion);
  const allowed = allowedScopes(worker);
  return [allowed.includes(raw) ? raw : 'mine', setScope];
}

export function inScope(m: Mother, scope: Scope, worker: Worker | undefined): boolean {
  if (!worker || scope === 'all') return true;
  const p = profileOf(worker);
  const own = m.assignedWorkerId === worker.id || Boolean(p?.caseloadMotherIds?.includes(m.id));
  if (scope === 'facility') return own || m.facilityId === worker.facilityId;
  return own;
}

// ---------- Mode: health worker or a mother using Gaskin for herself ----------

export function usePersonalMode(): boolean {
  const saved = useSetup();
  const role = (saved?.answers as { role?: string } | undefined)?.role;
  if (role === 'personal' || role === 'mother') return true;
  try {
    return Boolean(currentProfile()?.personal);
  } catch {
    return false;
  }
}

/** Which mother "me" is in personal mode: the personal profile's record, else the first on the device. */
export function personalMotherId(mothers: Mother[]): string | undefined {
  try {
    const p = currentProfile();
    const id = p?.personal ? p.caseloadMotherIds?.[0] : undefined;
    if (id && mothers.some((m) => m.id === id)) return id;
  } catch {
    /* ignore */
  }
  return mothers[0]?.id;
}

// ---------- Legal: emergency number ----------

/** The number to dial (digits only) and the line to show, from src/legal. */
export function emergencyNumberFor(country: CountryCode | string): { number: string; line: string } {
  const e = EMERGENCY_NUMBERS[country as keyof typeof EMERGENCY_NUMBERS];
  const line = legalEmergency(country) ?? COUNTRIES[country as CountryCode]?.emergencyLine ?? '112';
  return { number: e?.primary ?? line.match(/\d{3,}/)?.[0] ?? '112', line };
}

// ---------- Geo: places and languages ----------

export interface PlaceOption {
  id: string;
  label: string;
}

function asOptions(v: unknown): PlaceOption[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .map((x) => {
      if (typeof x === 'string') return { id: x, label: x };
      if (x && typeof x === 'object') {
        const o = x as { id?: string; code?: string; name?: string; label?: string };
        const label = o.name ?? o.label ?? o.id ?? o.code;
        const id = o.id ?? o.code ?? label;
        return label && id ? { id: String(id), label: String(label) } : null;
      }
      return null;
    })
    .filter((x): x is PlaceOption => Boolean(x));
}

function geoCall(names: string[], ...args: unknown[]): unknown {
  for (const n of names) {
    const fn = geoMod?.[n];
    if (typeof fn === 'function') {
      try {
        return (fn as (...a: unknown[]) => unknown)(...args);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export const HAS_GEO = Boolean(geoMod);

export function countryOptions(): PlaceOption[] {
  return asOptions(geoCall(['countries', 'listCountries'])) ?? (Object.keys(COUNTRIES) as CountryCode[]).map((c) => ({ id: c, label: COUNTRIES[c].name }));
}

export function regionOptions(country: string): PlaceOption[] {
  // Her record keeps the region's name (as the plans and location profiles expect), so ids are names.
  const fromGeo = asOptions(geoCall(['regionsOf', 'regionsFor', 'listRegions', 'regions'], country))?.map((o) => ({ id: o.label, label: o.label }));
  if (fromGeo?.length) return fromGeo;
  const names = new Set<string>([...(COUNTRIES[country as CountryCode]?.regions ?? []), ...safeRegions(country)]);
  return [...names].sort((a, b) => a.localeCompare(b)).map((r) => ({ id: r, label: r }));
}

function safeRegions(country: string): string[] {
  try {
    return listRegions(country as CountryCode);
  } catch {
    return [];
  }
}

/** Areas (LGAs, sub-counties, districts) for a region: synchronous when already loaded, else null. */
export function areaOptionsSync(country: string, region: string): PlaceOption[] | null {
  const r = geoCall(['listAreasSync'], country, region);
  if (r === null) return null;
  return asOptions(r) ?? [];
}

/** Load the area list for a country once (src/geo splits it out of the main bundle). */
export async function loadAreaOptions(country: string, region: string): Promise<PlaceOption[]> {
  try {
    const r = await (geoCall(['loadAreas'], country, region) as Promise<unknown> | undefined);
    return asOptions(r) ?? [];
  } catch {
    return [];
  }
}

export function areaWord(country: string): string {
  const w = geoCall(['placeWords'], country) as { area?: string } | undefined;
  return w?.area ?? (country === 'NG' ? 'Local government area (LGA)' : country === 'KE' ? 'Sub-county' : 'District');
}

export function regionWord(country: string): string {
  const w = geoCall(['placeWords'], country) as { region?: string } | undefined;
  return w?.region ?? (country === 'NG' ? 'State' : country === 'KE' ? 'County' : 'Region');
}

export interface LanguageOption {
  code: string;
  name: string;
  /** A language pack exists, so her messages and handouts can be in it. */
  hasPack: boolean;
  /** Spoken where she lives (shown first); the rest sit behind "More languages". */
  local: boolean;
}

/** Languages for her place: src/geo's languagesFor() when present, else the country's list. */
export function languageOptions(country: string, region: string, area?: string): LanguageOption[] {
  const raw = geoCall(['languagesFor'], country, region, area) ?? geoCall(['languagesFor'], { country, region, area });
  const local: string[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === 'string') local.push(x);
      else if (x && typeof x === 'object' && 'code' in x) local.push(String((x as { code: string }).code));
    }
  }
  if (!local.length) {
    // Until src/geo offers languagesFor(): her region's language, the country's, then the
    // languages the open data lists for the country with at least 1% of speakers.
    const byRegion = REGION_LANGUAGE[region] ?? REGION_LANGUAGE[region.replace(/\s+(State|County|Region)$/i, '')];
    if (byRegion) local.push(byRegion);
    local.push(...(COUNTRIES[country as CountryCode]?.languages ?? []));
    for (const part of (geoLangs?.territories?.[country] ?? '').split('|')) {
      const [code, share] = part.split(':');
      if (code && Number(share) >= 1 && !local.includes(code)) local.push(code === 'fuv' ? 'ff' : code);
    }
  }
  if (!local.includes('en')) local.push('en');
  const all = new Set<string>([...local, ...Object.keys(LANGUAGE_NAMES)]);
  const nameOf = (c: string) => {
    if (Array.isArray(raw)) {
      const hit = raw.find((x) => x && typeof x === 'object' && (x as { code?: string }).code === c) as { name?: string } | undefined;
      if (hit?.name) return hit.name;
    }
    return LANGUAGE_NAMES[c as LanguageCode] ?? geoLangs?.names?.[c]?.[0] ?? c;
  };
  const seen = new Set<string>();
  return [...all]
    .filter((c) => (seen.has(c) ? false : (seen.add(c), true)))
    .map((code) => ({ code, name: nameOf(code), hasPack: isPackCode(code) && code in LANGUAGE_NAMES, local: local.includes(code) }));
}
