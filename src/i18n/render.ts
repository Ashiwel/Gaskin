import type { Alert, IllustrationKey, PlanCategory, PlanItem } from '../types';
import { englishTemplate } from './templates';
import type { Confidence, DualRendering, LanguagePack, MotherRendering, PackCode } from './types';
import { EN_UI, type UiKey } from './uiKeys';
import { getPack } from './registry';
import { isCheckedLocally } from './reviews';

type Params = Record<string, string | number>;

/** Placeholders whose values are words for the mother and must be translated through the glossary */
const TRANSLATABLE_PARAMS = new Set(['food', 'food1', 'food2', 'fruit']);
/** Placeholders that are dates ('12 Nov') or lists of dates ('12 Nov, 10 Dec') */
const DATE_PARAMS = new Set(['date', 'dates']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function placeholdersOf(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

function fill(template: string, params: Params): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

function entryConfidence(pack: LanguagePack, id: string): Confidence {
  const own = pack.confidence?.[id];
  if (own) return own;
  return pack.status === 'reviewed' ? 'reviewed' : 'draft';
}

/** Translate one date or date list through the pack's month glossary; numbers are kept as they are. */
function translateDates(value: string, pack: LanguagePack): string | null {
  let ok = true;
  const out = value.replace(/\b(\d{1,2}) ([A-Z][a-z]{2})\b/g, (whole, d: string, m: string) => {
    if (!MONTHS.includes(m)) return whole;
    const pattern = pack.glossary[`date:${m}`];
    if (!pattern) {
      ok = false;
      return whole;
    }
    return pattern.replace('{d}', d);
  });
  return ok ? out : null;
}

/**
 * Translate placeholder values. Food servings and the generic 'the baby' are looked up in the
 * glossary; a baby's own name passes through. Returns null if a value that must be translated
 * has no glossary entry, so the caller can fall back to English rather than mix languages.
 */
function translateParams(params: Params, pack: LanguagePack): { params: Params; confidence: Confidence } | null {
  const out: Params = {};
  let conf: Confidence = 'reviewed';
  const lower = (c: Confidence) => {
    if (c === 'fallback' || (c === 'draft' && conf === 'reviewed')) conf = c;
  };
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'number') {
      out[k] = v;
      continue;
    }
    if (TRANSLATABLE_PARAMS.has(k)) {
      const g = pack.glossary[v] ?? pack.glossary[v.toLowerCase()];
      if (g === undefined) return null;
      lower(entryConfidence(pack, `glossary:${v}`));
      out[k] = g;
    } else if (DATE_PARAMS.has(k)) {
      const d = translateDates(v, pack);
      if (d === null) return null;
      out[k] = d;
    } else {
      const g = pack.glossary[v];
      if (g !== undefined) lower(entryConfidence(pack, `glossary:${v}`));
      out[k] = g ?? v;
    }
  }
  return { params: out, confidence: conf };
}

function minConfidence(a: Confidence, b: Confidence): Confidence {
  const rank: Record<Confidence, number> = { reviewed: 2, draft: 1, fallback: 0 };
  return rank[a] <= rank[b] ? a : b;
}

/** English plain-language source for a key; throws for an unknown key like the clinical table does */
export function englishMotherText(key: string, params: Params = {}): string {
  const t = englishTemplate(key);
  if (t === undefined) throw new Error(`Missing mother-text template: ${key}`);
  return fill(t, params);
}

/**
 * Render a mother-facing template in her language, falling back to plain English.
 * The result says which language it is actually in and how far to trust it.
 */
export function renderMotherText(key: string, params: Params = {}, lang: PackCode = 'en'): MotherRendering {
  const english = englishMotherText(key, params);
  const enDir = 'ltr' as const;
  const base = { english, key };
  if (lang === 'en') {
    return { ...base, text: english, lang: 'en', confidence: 'reviewed', checkedLocally: false, dir: enDir };
  }
  const pack = getPack(lang);
  const template = pack.mother[key];
  if (template === undefined) {
    return { ...base, text: english, lang: 'en', confidence: 'fallback', missing: 'template', checkedLocally: false, dir: enDir };
  }
  const tp = translateParams(params, pack);
  if (!tp) {
    return { ...base, text: english, lang: 'en', confidence: 'fallback', missing: 'glossary', checkedLocally: false, dir: enDir };
  }
  const text = fill(template, tp.params);
  const confidence = minConfidence(entryConfidence(pack, `mother:${key}`), tp.confidence);
  return { ...base, text, lang, confidence, checkedLocally: isCheckedLocally(lang, key, text), dir: pack.direction };
}

/** Free English text with no template key (worker-added items, old overrides): shown in English */
export function renderUntemplated(english: string, lang: PackCode): MotherRendering {
  return { english, text: english, lang: 'en', confidence: lang === 'en' ? 'reviewed' : 'fallback', missing: lang === 'en' ? undefined : 'key', checkedLocally: false, dir: 'ltr' };
}

/** Worker UI string in her language, falling back to English. */
export function t(key: UiKey, lang: PackCode = 'en', params?: Params): string {
  const s = (lang === 'en' ? undefined : getPack(lang).ui[key]) ?? EN_UI[key] ?? key;
  return params ? fill(s, params) : s;
}

export function uiConfidence(key: UiKey, lang: PackCode): Confidence {
  if (lang === 'en') return 'reviewed';
  const p = getPack(lang);
  return p.ui[key] === undefined ? 'fallback' : entryConfidence(p, `ui:${key}`);
}

/** `dir` attribute for a container in this language */
export function dirFor(lang: PackCode): 'ltr' | 'rtl' {
  return getPack(lang).direction;
}

// ---------- Plan items and alerts ----------

export function isAlert(x: PlanItem | Alert): x is Alert {
  return 'level' in x && 'action' in x;
}

/** Same mapping the engine uses for referral items, so alerts and their referral items share a picture */
export function illustrationForAlert(id: string): IllustrationKey {
  if (/bleed|haemorrhage/.test(id)) return 'danger_bleeding';
  if (/eclampsia|hypertension|bp/.test(id)) return 'danger_headache';
  if (/convuls/.test(id)) return 'danger_convulsion';
  if (/fever|sepsis|malaria|mastitis/.test(id)) return 'danger_fever';
  if (/fetal/.test(id)) return 'danger_baby_movement';
  if (/breath|dvt/.test(id)) return 'danger_breathing';
  if (/newborn|child|jaundice|cord|diarrhoea|malnutrition/.test(id)) return 'baby_danger';
  if (/self_harm|depression|mood/.test(id)) return 'talk_to_someone';
  if (/anaemia/.test(id)) return 'iron_tablet';
  return 'clinic_visit';
}

const CATEGORY_ILLUSTRATION: Record<PlanCategory, IllustrationKey> = {
  danger_signs: 'danger_bleeding',
  visits: 'clinic_visit',
  tests: 'test_tube',
  medication: 'medicine',
  nutrition: 'balanced_plate',
  rest_and_sleep: 'rest',
  activity: 'walking',
  breastfeeding: 'breastfeeding',
  baby_care: 'warm_baby',
  immunisation: 'vaccination',
  mental_health: 'talk_to_someone',
  family_support: 'family_support',
  birth_preparedness: 'birth_bag',
  family_planning: 'family_planning',
  traditional_practice: 'family_support',
  education: 'clinic_visit',
};

function motherFor(x: PlanItem | Alert, lang: PackCode): MotherRendering | null {
  if (x.motherTextKey && englishTemplate(x.motherTextKey) !== undefined) return renderMotherText(x.motherTextKey, x.motherTextParams ?? {}, lang);
  if (x.motherText) return renderUntemplated(x.motherText, lang);
  if (isAlert(x)) return renderMotherText('alert.fallback', {}, lang);
  return null;
}

/**
 * Both renderings of one plan item or alert: the worker's (her language, clinical detail)
 * and the mother's (her language, plain words), with the safety flags the views must honour.
 */
export function renderForBoth(x: PlanItem | Alert, workerLang: PackCode, motherLang: PackCode): DualRendering {
  const alert = isAlert(x);
  const isDanger = alert || x.category === 'danger_signs' || x.id.startsWith('refer.');
  const illustration: IllustrationKey = alert ? illustrationForAlert(x.id) : x.illustration ?? (x.id.startsWith('refer.') ? illustrationForAlert(x.id) : CATEGORY_ILLUSTRATION[x.category]);
  const forMother = alert || x.audience !== 'worker';
  const mother = forMother ? motherFor(x, motherLang) : null;
  const plainForWorker = motherFor(x, workerLang);
  const headingKey: UiKey = alert ? (`alert.level.${x.level}` as UiKey) : (`cat.${x.category}` as UiKey);
  const english = mother?.english ?? plainForWorker?.english ?? '';
  const notReviewed = !!mother && mother.confidence !== 'reviewed';
  return {
    kind: alert ? 'alert' : 'item',
    id: x.id,
    isDanger,
    level: alert ? x.level : undefined,
    illustration,
    worker: {
      lang: workerLang,
      dir: dirFor(workerLang),
      heading: t(headingKey, workerLang),
      headingConfidence: uiConfidence(headingKey, workerLang),
      title: x.title,
      detail: alert ? `${x.action} ${x.reason}`.trim() : x.detail,
      clinicalLang: 'en',
      plain: plainForWorker,
    },
    mother,
    english,
    // Danger lines always carry their picture; other lines show one when they have it
    showPictogram: isDanger || !!(!alert && x.illustration),
    // Danger line not reviewed and requested in another language: the English line goes beneath
    showEnglishBeneath: isDanger && notReviewed && motherLang !== 'en' && mother!.lang !== 'en',
  };
}
