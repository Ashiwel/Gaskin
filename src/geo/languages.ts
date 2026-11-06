/**
 * Which languages to offer for a place, and which Gaskin pack (if any) serves each.
 *
 * Order of evidence, most specific first:
 * 1. Curated lists for an area (LGA, sub-county, district) where one exists (./curated.ts).
 * 2. Curated lists for a region (every Nigerian state, Kenyan county and Ghanaian region; South African provinces).
 * 3. CLDR territoryInfo for the country (share of the population that speaks each language).
 * A country's list never borrows another country's languages. English is always offered, and
 * French, Portuguese and Arabic too wherever CLDR records them as official.
 *
 * A language with no pack is still a real choice: a mother can be recorded as speaking Tiv or
 * isiNdebele. Her messages then fall back to plain English, and the UI says "Coming soon".
 */
import LANG_DATA from './data/languages.json';
import { PACKS, isPackCode } from '../i18n/registry';
import type { PackCode, PackStatus } from '../i18n/types';
import { CURATED_AREAS, EXTRA_LANGUAGE_NAMES } from './curated';
import { findArea, findRegion, fold, getCountry, type Region } from './places';

/** Pack state as the language picker shows it */
export type PackState = 'reviewed' | 'draft' | 'partial' | 'none';

export interface LanguageChoice {
  /** BCP-47 tag, e.g. 'zu', 'tiv', 'fuv', 'ha' */
  tag: string;
  /**
   * The value to store when this language is picked: the pack code when Gaskin has a pack,
   * otherwise the tag. (Same as `packCode ?? tag`.)
   */
  code: string;
  /** English name, e.g. 'Zulu' */
  name: string;
  /** Name in the language itself, e.g. 'isiZulu' (the English name when unknown) */
  nativeName: string;
  /** Share of the whole country's population that speaks it, in percent (CLDR national figure, not the region's) */
  share?: number;
  /** Official (or official in a region) according to CLDR */
  official?: boolean;
  /** State of Gaskin's pack for it; 'none' means plain English for now ("Coming soon") */
  pack: PackState;
  /** Gaskin pack serving this language, when one exists (even an empty one) */
  packCode?: PackCode;
  /**
   * Where it came from: 'area' | 'region' | 'country' (CLDR) | 'always' (English and official lingua francas),
   * or 'other' for the rest of the "More languages" list (not spoken here as far as Gaskin knows).
   */
  from: 'area' | 'region' | 'country' | 'always' | 'other';
}

/** One wording for pack states, used everywhere (founder: languages with no pack say "Coming soon"). */
export const PACK_STATE_LABELS: Record<PackState, string> = {
  reviewed: 'Reviewed',
  draft: 'Draft',
  partial: 'Partial',
  none: 'Coming soon',
};

/** The note shown with a language that has no pack yet */
export const NO_PACK_NOTE = 'Coming soon. Messages use plain English for now. Native speakers can help build this language: see Settings, Languages.';

export function packStateLabel(state: PackState): string {
  return PACK_STATE_LABELS[state];
}

// ---------------------------------------------------------------------------
// Tags and packs
// ---------------------------------------------------------------------------

/**
 * Tags (and common ISO 639-3 or macrolanguage codes) that a Gaskin pack serves.
 * One to one where the pack is the language; a few close varieties share a pack:
 * Akan → Twi, Shuwa Arabic → Arabic (the pack is written MSA; reviewers adapt it), every Fula variety → Fulfulde.
 */
const PACK_ALIASES: Record<string, PackCode> = {
  eng: 'en', hau: 'ha', yor: 'yo', ibo: 'ig', swa: 'sw', swh: 'sw', swc: 'sw',
  twi: 'tw', ak: 'tw', aka: 'tw',
  ara: 'ar', arb: 'ar', shu: 'ar', apd: 'ar', ayl: 'ar', arz: 'ar', apc: 'ar', ary: 'ar', aeb: 'ar', arq: 'ar',
  ful: 'ff', fuv: 'ff', fuh: 'ff', fub: 'ff', fue: 'ff', fuq: 'ff', ffm: 'ff', fuf: 'ff', fuc: 'ff',
  dag: 'dag', luo: 'luo', ewe: 'ee', urh: 'urh', bin: 'bin', pcm: 'pcm',
  fra: 'fr', fre: 'fr', por: 'pt',
  zul: 'zu', xho: 'xh', kin: 'rw', lin: 'ln', nya: 'ny', sna: 'sn', lug: 'lg', kik: 'ki', sot: 'st', tsn: 'tn',
};

/** Canonical tag for a pack code (what languagesFor reports) */
function canonical(tag: string): string {
  const t = tag.trim();
  const lower = t.toLowerCase();
  if (lower === 'ak' || lower === 'aka' || lower === 'twi') return 'tw';
  if (lower === 'nya') return 'ny';
  return t.includes('-') ? t : lower;
}

/**
 * The Gaskin pack for a BCP-47 tag, or undefined. Accepts 'zu', 'zu-ZA', 'zul', 'nya', 'fuv', 'ar-TD', 'shu', 'pt-MZ'…
 * A pack may exist with no translations yet (status 'none'); see packStateFor.
 */
export function packFor(tag: string | undefined): PackCode | undefined {
  if (!tag) return undefined;
  const t = tag.trim();
  if (!t) return undefined;
  if (isPackCode(t)) return t;
  const lower = t.toLowerCase();
  if (isPackCode(lower)) return lower;
  const primary = lower.split(/[-_]/)[0];
  if (PACK_ALIASES[lower]) return PACK_ALIASES[lower];
  if (isPackCode(primary)) return primary;
  return PACK_ALIASES[primary];
}

function stateOf(status: PackStatus | undefined): PackState {
  switch (status) {
    case 'reviewed':
      return 'reviewed';
    case 'machine_draft':
      return 'draft';
    case 'partial':
      return 'partial';
    default:
      return 'none';
  }
}

/** Pack state for a tag: read live from the pack registry, so new packs show the right badge. */
export function packStateFor(tag: string | undefined): PackState {
  const code = packFor(tag);
  if (!code) return 'none';
  if (code === 'en') return 'reviewed';
  return stateOf(PACKS[code]?.status);
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const DATA = LANG_DATA as { territories: Record<string, string>; names: Record<string, string[]> };

/** English and native name for any tag Gaskin knows; the tag itself when unknown */
export function languageNames(tag: string): { name: string; nativeName: string } {
  const t = canonical(tag);
  const base = t.split('-')[0];
  const extra = EXTRA_LANGUAGE_NAMES[t] ?? EXTRA_LANGUAGE_NAMES[base];
  if (extra) return { name: extra[0], nativeName: extra[1] ?? extra[0] };
  const code = packFor(t);
  if (code && (code === t || code === base)) {
    const p = PACKS[code];
    if (p) return { name: p.name, nativeName: p.nativeName };
  }
  const cldr = DATA.names[t] ?? DATA.names[base];
  if (cldr) return { name: cldr[0], nativeName: cldr[1] ?? cldr[0] };
  return { name: tag, nativeName: tag };
}

export function describeLanguage(tag: string, from: LanguageChoice['from'] = 'country', extra: Partial<Pick<LanguageChoice, 'share' | 'official'>> = {}): LanguageChoice {
  const t = canonical(tag);
  const packCode = packFor(t);
  const { name, nativeName } = languageNames(t);
  return { tag: t, code: packCode ?? t, name, nativeName, pack: packStateFor(t), ...(packCode ? { packCode } : {}), from, ...extra };
}

// ---------------------------------------------------------------------------
// Country data (CLDR)
// ---------------------------------------------------------------------------

interface CountryLang {
  tag: string;
  share: number;
  official: boolean;
}

const cache = new Map<string, CountryLang[]>();

function countryLanguages(country: string): CountryLang[] {
  const c = country.toUpperCase();
  if (cache.has(c)) return cache.get(c)!;
  const packed = DATA.territories[c];
  const list: CountryLang[] = packed
    ? packed.split('|').map((s) => {
        const [tag, share, flag] = s.split(':');
        return { tag: canonical(tag), share: Number(share), official: flag === 'o' || flag === 'r' };
      })
    : [];
  cache.set(c, list);
  return list;
}

/** Below this share (percent) a language is left to "More languages" unless it is official */
const MIN_SHARE = 0.05;

/** Lingua francas offered wherever they are official */
const ALWAYS_IF_OFFICIAL = ['fr', 'pt', 'ar'];

// ---------------------------------------------------------------------------
// languagesFor
// ---------------------------------------------------------------------------

export interface PlaceInput {
  country?: string;
  region?: string;
  area?: string;
  /** Alias of area (the onboarding UI calls it district) */
  district?: string;
}

const AREA_KEY = (s: string) => fold(s).replace(/\s+/g, '');

function curatedArea(region: Region | undefined, area: string | undefined): string[] | undefined {
  if (!region || !area) return undefined;
  const entry = CURATED_AREAS[region.code];
  if (!entry?.areas) return undefined;
  const loaded = findArea(region.country, region.code, area);
  const name = loaded?.name ?? area;
  const k = AREA_KEY(name);
  for (const [n, tags] of Object.entries(entry.areas)) if (AREA_KEY(n) === k) return tags;
  return undefined;
}

/**
 * Languages for a place, ordered by likely relevance. Country is an ISO 3166-1 alpha-2 code;
 * region an ISO 3166-2 code or name ('Lagos', 'NG-LA', 'Kisumu County'); area an LGA,
 * sub-county or district name. Also accepts one object: languagesFor({ country, region, area }).
 *
 * Never returns another country's languages. Always includes English, and French, Portuguese or
 * Arabic where official. Unknown country: English only.
 */
export function languagesFor(country: string | PlaceInput | undefined, region?: string, area?: string): LanguageChoice[] {
  if (country && typeof country === 'object') return languagesFor(country.country, country.region, country.area ?? country.district);
  const cc = (country ?? '').toUpperCase();
  if (!getCountry(cc)) return [describeLanguage('en', 'always')];
  const national = countryLanguages(cc);
  const byTag = new Map(national.map((l) => [l.tag, l]));
  const reg = findRegion(cc, region);
  const out: LanguageChoice[] = [];
  const seen = new Set<string>();
  const add = (tag: string, from: LanguageChoice['from']) => {
    const t = canonical(tag);
    if (seen.has(t)) return;
    seen.add(t);
    const n = byTag.get(t);
    out.push(describeLanguage(t, from, n ? { share: n.share, ...(n.official ? { official: true } : {}) } : {}));
  };
  for (const t of curatedArea(reg, area) ?? []) add(t, 'area');
  for (const t of (reg && CURATED_AREAS[reg.code]?.tags) ?? []) add(t, 'region');
  // With a curated region, the rest of the country is behind "More languages": CLDR's national
  // "official" flags (Yoruba in all of Nigeria, all 12 in South Africa) would otherwise leak into every region.
  const curatedRegion = Boolean(reg && CURATED_AREAS[reg.code]);
  if (!curatedRegion) {
    for (const l of national) {
      if (l.share < MIN_SHARE && !l.official) continue;
      add(l.tag, 'country');
    }
  }
  add('en', 'always');
  for (const t of ALWAYS_IF_OFFICIAL) if (byTag.get(t)?.official) add(t, 'always');
  return out;
}

/** Why these languages: the citation for the most specific curated list used, or CLDR */
export function languageSource(country: string | undefined, region?: string): { label: string; approximate: boolean } {
  const reg = findRegion(country, region);
  const c = reg && CURATED_AREAS[reg.code];
  if (c) return { label: c.source, approximate: c.approximate };
  return { label: 'Unicode CLDR 48, territory information (share of population speaking each language)', approximate: true };
}

/**
 * Every language Gaskin can name, for the searchable "More languages" list: the place's languages
 * first (as languagesFor), then the rest of the country's (CLDR), then every other language A to Z
 * with from: 'other' (group these under "Other languages"). Another country's languages are never
 * placed among the suggestions; they are only reachable by searching the full list.
 */
export function allLanguages(place: PlaceInput = {}): LanguageChoice[] {
  const out = new Map<string, LanguageChoice>();
  for (const l of languagesFor(place)) out.set(l.tag, l);
  if (place.country && getCountry(place.country)) {
    for (const l of countryLanguages(place.country)) if (!out.has(l.tag)) out.set(l.tag, describeLanguage(l.tag, 'country', { share: l.share, ...(l.official ? { official: true } : {}) }));
  }
  const rest = [...new Set([...Object.keys(PACKS), ...Object.keys(DATA.names), ...Object.keys(EXTRA_LANGUAGE_NAMES)])]
    .map(canonical)
    .filter((t) => !out.has(t) && !t.includes('-'))
    .map((t) => describeLanguage(t, 'other'))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const l of rest) if (!out.has(l.tag)) out.set(l.tag, l);
  return [...out.values()];
}

/** Search languages by English or native name or tag; the place's languages rank first among equals */
export function searchLanguages(query: string, place: PlaceInput = {}, limit = 50): LanguageChoice[] {
  const q = fold(query);
  const all = allLanguages(place);
  if (!q) return all.slice(0, limit);
  const scored: Array<[number, number, LanguageChoice]> = [];
  all.forEach((l, i) => {
    const names = [l.name, l.nativeName].map(fold);
    let s = -1;
    if (l.tag === q || l.code === q) s = 0;
    else if (names.some((n) => n === q)) s = 1;
    else if (names.some((n) => n.startsWith(q))) s = 2;
    else if (names.some((n) => n.split(' ').some((w) => w.startsWith(q)))) s = 3;
    else if (q.length >= 3 && names.some((n) => n.includes(q))) s = 4;
    if (s >= 0) scored.push([s, i, l]);
  });
  return scored
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .slice(0, limit)
    .map(([, , l]) => l);
}

/**
 * The language a new patient most likely speaks at a place, as a tag plus the pack to render with.
 * Pidgin is never chosen as a default. An explicit choice wins; then the place's first language;
 * then the onboarding default; then English.
 */
export function defaultLanguageForPlace(place: PlaceInput, opts: { explicit?: string; onboardingDefault?: string } = {}): { tag: string; packCode?: PackCode; pack: PackState } {
  const pick = (tag: string) => {
    const d = describeLanguage(tag);
    return { tag: d.tag, ...(d.packCode ? { packCode: d.packCode } : {}), pack: d.pack };
  };
  if (opts.explicit) return pick(opts.explicit);
  const list = languagesFor(place).filter((l) => l.tag !== 'pcm');
  const localFirst = list.find((l) => l.from === 'area' || l.from === 'region') ?? list[0];
  if (place.country && localFirst) return pick(localFirst.tag);
  if (opts.onboardingDefault && opts.onboardingDefault !== 'pcm') return pick(opts.onboardingDefault);
  return pick('en');
}
