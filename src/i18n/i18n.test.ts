import { describe, expect, it, beforeEach } from 'vitest';
import type { Alert, PlanItem } from '../types';
import { MOTHER_TEXT } from '../clinical/motherText';
import {
  PACKS,
  PACK_ORDER,
  UI_KEYS,
  EN_UI,
  getPack,
  installPack,
  installedLanguages,
  isInstalled,
  uninstallPack,
  renderMotherText,
  renderForBoth,
  t,
  dirFor,
  placeholdersOf,
  englishTemplates,
  registerTemplates,
  markChecked,
  unmarkChecked,
  isCheckedLocally,
  defaultPatientLanguage,
  backTranslate,
  setBackTranslator,
  summarisePack,
  type PackCode,
} from './index';
import { _clearStorage } from './storage';
import { INSTALLED_KEY } from './registry';
import { REVIEWS_KEY } from './reviews';

const DRAFT_CODES: PackCode[] = ['ha', 'yo', 'ig', 'sw', 'tw', 'ar', 'fr', 'pcm'];
const NONE_CODES: PackCode[] = ['bin', 'urh', 'luo', 'ee', 'dag', 'ff'];

beforeEach(() => _clearStorage([INSTALLED_KEY, REVIEWS_KEY]));

describe('templates', () => {
  it('every MOTHER_TEXT key has an English rendering', () => {
    for (const key of Object.keys(MOTHER_TEXT)) {
      const r = renderMotherText(key, { name: 'Ada', date: '12 Nov', dates: '12 Nov, 10 Dec', food: 'groundnut paste and crayfish', food1: 'one egg', food2: 'a cup of cooked beans', fruit: 'a fruit' }, 'en');
      expect(r.text.length, key).toBeGreaterThan(0);
      expect(r.text, key).not.toMatch(/\{\w+\}/);
      expect(r.confidence).toBe('reviewed');
    }
  });

  it('the English pack mirrors every template', () => {
    expect(Object.keys(getPack('en').mother).sort()).toEqual(Object.keys(englishTemplates()).sort());
  });

  it('every pack key exists in English (no orphan translations)', () => {
    const keys = new Set(Object.keys(englishTemplates()));
    for (const code of PACK_ORDER) {
      const orphans = Object.keys(PACKS[code].mother).filter((k) => !keys.has(k));
      expect(orphans, code).toEqual([]);
      const uiOrphans = Object.keys(PACKS[code].ui).filter((k) => !(k in EN_UI));
      expect(uiOrphans, code).toEqual([]);
    }
  });

  it('placeholders are preserved in every translation', () => {
    const bad: string[] = [];
    for (const code of PACK_ORDER) {
      for (const [k, v] of Object.entries(PACKS[code].mother)) {
        if (placeholdersOf(v).join() !== placeholdersOf(englishTemplates()[k]).join()) bad.push(`${code}:${k}`);
      }
      for (const [k, v] of Object.entries(PACKS[code].ui)) {
        if (placeholdersOf(v as string).join() !== placeholdersOf(EN_UI[k as keyof typeof EN_UI]).join()) bad.push(`${code}:ui:${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('numbers in a template survive translation', () => {
    const nums = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',');
    const bad: string[] = [];
    for (const code of PACK_ORDER) {
      if (code === 'en') continue;
      for (const [k, v] of Object.entries(PACKS[code].mother)) if (nums(v) !== nums(englishTemplates()[k])) bad.push(`${code}:${k}: ${nums(v)} vs ${nums(englishTemplates()[k])}`);
    }
    expect(bad).toEqual([]);
  });

  it('full-draft packs translate every MOTHER_TEXT template', () => {
    for (const code of ['sw', 'fr', 'pcm'] as PackCode[]) {
      const missing = Object.keys(MOTHER_TEXT).filter((k) => PACKS[code].mother[k] === undefined && k !== 'birth.sha');
      expect(missing, code).toEqual([]);
    }
  });

  it('templates from another module can be registered and fall back to English', () => {
    registerTemplates('test_visits', { 'visit.test_line': 'Bring {name} back in {n} days.' });
    const r = renderMotherText('visit.test_line', { name: 'Ada', n: 3 }, 'ha');
    expect(r.text).toBe('Bring Ada back in 3 days.');
    expect(r.confidence).toBe('fallback');
    expect(() => registerTemplates('clash', { 'alert.go_now': 'Different text' })).toThrow();
  });
});

describe('packs', () => {
  it('statuses and licences are set as designed', () => {
    for (const c of PACK_ORDER) expect(PACKS[c].licence).toBe('CC-BY-4.0');
    expect(PACKS.en.status).toBe('reviewed');
    for (const c of DRAFT_CODES) expect(['machine_draft', 'partial']).toContain(PACKS[c].status);
    for (const c of NONE_CODES) {
      expect(PACKS[c].status).toBe('none');
      expect(Object.keys(PACKS[c].mother)).toHaveLength(0);
      expect(PACKS[c].note).toMatch(/Help build this pack/);
    }
  });

  it('draft packs say they need review by native-speaking midwives', () => {
    for (const c of DRAFT_CODES) expect(PACKS[c].note).toMatch(/Native-speaking midwives must review/);
  });

  it('Arabic is right to left; everything else left to right', () => {
    expect(PACKS.ar.direction).toBe('rtl');
    expect(dirFor('ar')).toBe('rtl');
    for (const c of PACK_ORDER.filter((x) => x !== 'ar')) expect(PACKS[c].direction).toBe('ltr');
    const r = renderMotherText('alert.go_now', {}, 'ar');
    expect(r.dir).toBe('rtl');
    expect(r.lang).toBe('ar');
  });

  it('uses the right letters for each orthography', () => {
    const all = (c: PackCode) => Object.values(PACKS[c].mother).join(' ');
    expect(all('ha')).toMatch(/[ɓɗƙ]/);
    expect(all('yo')).toMatch(/[ẹọṣ]/);
    expect(all('ig')).toMatch(/[ịọụṅ]/);
    expect(all('tw')).toMatch(/[ɛɔ]/);
    expect(all('ar')).toMatch(/[؀-ۿ]/);
  });

  it('Pidgin never appears in other packs or as a default', () => {
    expect(defaultPatientLanguage(undefined)).not.toBe('pcm');
    for (const c of PACK_ORDER.filter((x) => x !== 'pcm')) {
      expect(Object.values(PACKS[c].mother).join(' '), c).not.toMatch(/\b(abeg|wetin|pikin|dey)\b/i);
    }
  });

  it('summaries report coverage and size', () => {
    const s = summarisePack('sw');
    expect(s.motherCoverage).toBeGreaterThan(0.95);
    expect(s.sizeBytes).toBeGreaterThan(1000);
    expect(summarisePack('luo').motherCoverage).toBe(0);
  });
});

describe('install', () => {
  it('English is always installed; others install once with progress', async () => {
    expect(installedLanguages()).toEqual(['en']);
    const seen: number[] = [];
    await installPack('sw', { durationMs: 0, onProgress: (f) => seen.push(f) });
    expect(isInstalled('sw')).toBe(true);
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
    await installPack('sw', { durationMs: 0 });
    expect(installedLanguages().filter((c) => c === 'sw')).toHaveLength(1);
    uninstallPack('sw');
    expect(isInstalled('sw')).toBe(false);
    uninstallPack('en');
    expect(isInstalled('en')).toBe(true);
  });

  it('can be cancelled', async () => {
    const ac = new AbortController();
    const p = installPack('ha', { durationMs: 50, signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toThrow(/cancelled/);
    expect(isInstalled('ha')).toBe(false);
  });
});

describe('rendering', () => {
  it('fills placeholders and translates glossary values and dates', () => {
    const r = renderMotherText('nutr.iron_foods.simple', { food1: 'a cup of cooked beans', fruit: 'a slice of pawpaw or a mango' }, 'sw');
    expect(r.text).toBe('Kila siku, kula kikombe cha maharagwe yaliyopikwa. Kula pia kipande cha papai au embe moja.');
    expect(r.confidence).toBe('draft');
    expect(r.english).toBe('Each day, eat a cup of cooked beans. Eat a slice of pawpaw or a mango too.');
    const d = renderMotherText('visit.anc_next.date.simple', { date: '12 Nov' }, 'fr');
    expect(d.text).toBe('Prochaine visite : 12 novembre.');
    const h = renderMotherText('visit.anc_next.date.simple', { date: '3 Feb' }, 'ha');
    expect(h.text).toBe('Ziyara ta gaba: 3 ga Fabrairu.');
  });

  it('a baby name passes through; the generic baby is translated', () => {
    expect(renderMotherText('baby.cord_dry', { name: 'Chidi' }, 'sw').text).toContain('Chidi');
    expect(renderMotherText('baby.cord_dry', { name: 'the baby' }, 'sw').text).toContain('mtoto');
  });

  it('falls back to English when the template is missing', () => {
    const r = renderMotherText('birth.sha', {}, 'ha');
    expect(r.lang).toBe('en');
    expect(r.confidence).toBe('fallback');
    expect(r.missing).toBe('template');
    expect(r.text).toBe(MOTHER_TEXT['birth.sha']);
  });

  it('falls back to English rather than mixing languages when a food is not in the glossary', () => {
    const r = renderMotherText('nutr.iron_foods.simple', { food1: 'a bowl of something new', fruit: 'a fruit' }, 'sw');
    expect(r.lang).toBe('en');
    expect(r.missing).toBe('glossary');
    expect(r.text).toContain('a bowl of something new');
  });

  it('languages with no pack content fall back to plain English', () => {
    for (const c of NONE_CODES) {
      const r = renderMotherText('alert.go_now', {}, c);
      expect(r.text).toBe(MOTHER_TEXT['alert.go_now']);
      expect(r.confidence).toBe('fallback');
    }
  });

  it('unknown keys throw, like the clinical table', () => {
    expect(() => renderMotherText('no.such.key', {}, 'sw')).toThrow();
  });

  it('t() returns the worker string, falling back to English, and fills params', () => {
    expect(t('nav.today', 'sw')).toBe('Leo');
    expect(t('nav.today', 'luo')).toBe('Today');
    expect(t('pack.installing', 'fr', { pct: 40 })).toBe('Téléchargement 40 %');
    expect(t('cat.danger_signs', 'ar')).toBe('علامات الخطر');
  });

  it('has about 150 UI keys, fully translated in en, fr, sw and ar', () => {
    expect(UI_KEYS.length).toBeGreaterThanOrEqual(140);
    for (const c of ['fr', 'sw'] as PackCode[]) expect(summarisePack(c).uiCoverage, c).toBeGreaterThan(0.95);
    expect(summarisePack('ar').uiCoverage).toBeGreaterThan(0.75);
    expect(summarisePack('ha').uiCoverage).toBeGreaterThan(0.5);
  });
});

const alert = (over: Partial<Alert> = {}): Alert => ({
  id: 'alert.severe_pre_eclampsia',
  level: 'emergency',
  title: 'Severe pre-eclampsia',
  action: 'Give MgSO4 loading dose, refer now.',
  reason: 'BP 165/112 with headache.',
  sources: [],
  subject: 'mother',
  motherTextKey: 'alert.severe_pre_eclampsia',
  ...over,
});

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  id: 'rest.itn',
  category: 'rest_and_sleep',
  title: 'Sleep under an ITN',
  detail: 'LLIN every night.',
  motherText: MOTHER_TEXT['rest.itn'],
  motherTextKey: 'rest.itn',
  priority: 3,
  audience: 'both',
  evidence: 'A',
  sources: [],
  because: [],
  origin: 'guideline',
  illustration: 'mosquito_net',
  status: 'active',
  ...over,
});

describe('confidence rules', () => {
  it('alerts in a draft language show the pictogram and the English line beneath', () => {
    const r = renderForBoth(alert(), 'en', 'ha');
    expect(r.isDanger).toBe(true);
    expect(r.mother!.lang).toBe('ha');
    expect(r.mother!.confidence).toBe('draft');
    expect(r.showPictogram).toBe(true);
    expect(r.showEnglishBeneath).toBe(true);
    expect(r.illustration).toBe('danger_headache');
    expect(r.english).toMatch(/blood pressure is too high/);
  });

  it('alerts in a fallback language show the pictogram; the English is already the main line', () => {
    const r = renderForBoth(alert(), 'en', 'luo');
    expect(r.mother!.confidence).toBe('fallback');
    expect(r.mother!.lang).toBe('en');
    expect(r.showPictogram).toBe(true);
    expect(r.showEnglishBeneath).toBe(false);
  });

  it('alerts in English need no English line beneath', () => {
    const r = renderForBoth(alert(), 'sw', 'en');
    expect(r.mother!.confidence).toBe('reviewed');
    expect(r.showEnglishBeneath).toBe(false);
    expect(r.worker.heading).toBe('Dharura');
  });

  it('every alert key in every language either is draft with English beneath, or falls back', () => {
    for (const key of Object.keys(MOTHER_TEXT).filter((k) => k.startsWith('alert.'))) {
      for (const code of PACK_ORDER.filter((c) => c !== 'en')) {
        const r = renderForBoth(alert({ id: key.replace(/\.(urgent|emergency)$/, ''), motherTextKey: key }), 'en', code);
        expect(r.showPictogram, `${code}:${key}`).toBe(true);
        if (r.mother!.confidence === 'draft') expect(r.showEnglishBeneath, `${code}:${key}`).toBe(true);
        else expect(r.mother!.confidence, `${code}:${key}`).toBe('fallback');
      }
    }
  });

  it('danger-sign plan items follow the same rule; ordinary items do not repeat the English', () => {
    const danger = renderForBoth(item({ id: 'danger.pregnancy', category: 'danger_signs', motherTextKey: 'danger.pregnancy', illustration: undefined }), 'en', 'sw');
    expect(danger.isDanger).toBe(true);
    expect(danger.showEnglishBeneath).toBe(true);
    expect(danger.showPictogram).toBe(true);
    const plain = renderForBoth(item(), 'en', 'sw');
    expect(plain.isDanger).toBe(false);
    expect(plain.showEnglishBeneath).toBe(false);
    expect(plain.mother!.text).toBe('Lala ndani ya chandarua chenye dawa kila usiku, mwaka mzima.');
  });

  it('worker-only items have no mother rendering; untemplated text falls back', () => {
    expect(renderForBoth(item({ audience: 'worker' }), 'en', 'sw').mother).toBeNull();
    const r = renderForBoth(item({ motherTextKey: undefined, motherText: 'Eat beans and ugu every day.' }), 'en', 'sw');
    expect(r.mother!.confidence).toBe('fallback');
    expect(r.mother!.missing).toBe('key');
  });

  it('the worker sees the mother line in her own language too', () => {
    const r = renderForBoth(item(), 'fr', 'sw');
    expect(r.worker.plain!.lang).toBe('fr');
    expect(r.worker.heading).toBe('Repos et sommeil');
    expect(r.worker.dir).toBe('ltr');
    expect(renderForBoth(item(), 'ar', 'sw').worker.dir).toBe('rtl');
  });
});

describe('local review', () => {
  it('records "I checked this" for the exact text, and lapses if the text changes', () => {
    const r = renderMotherText('rest.itn', {}, 'ha');
    expect(r.checkedLocally).toBe(false);
    markChecked('ha', 'rest.itn', r.text, { workerId: 'w1' });
    expect(isCheckedLocally('ha', 'rest.itn', r.text)).toBe(true);
    expect(renderMotherText('rest.itn', {}, 'ha').checkedLocally).toBe(true);
    expect(isCheckedLocally('ha', 'rest.itn', `${r.text} changed`)).toBe(false);
    unmarkChecked('ha', 'rest.itn', r.text);
    expect(isCheckedLocally('ha', 'rest.itn', r.text)).toBe(false);
  });

  it('a local check never upgrades the confidence', () => {
    const r = renderMotherText('rest.itn', {}, 'ha');
    markChecked('ha', 'rest.itn', r.text);
    expect(renderMotherText('rest.itn', {}, 'ha').confidence).toBe('draft');
  });
});

describe('back-translation', () => {
  it('sends the template, not the filled-in line with her baby’s name', async () => {
    let sent = '';
    setBackTranslator(async (a) => {
      sent = a.key ? getPack(a.from).mother[a.key] : a.text;
      return 'back';
    });
    const r = renderMotherText('baby.cord_dry', { name: 'Chidi' }, 'sw');
    expect(await backTranslate({ key: r.key, text: r.text, from: 'sw', to: 'en' })).toBe('back');
    expect(sent).toContain('{name}');
    expect(sent).not.toContain('Chidi');
    setBackTranslator(null);
  });

  it('returns null when no live AI is available', async () => {
    setBackTranslator(null);
    expect(await backTranslate({ key: 'rest.itn', text: 'x', from: 'sw', to: 'en' })).toBeNull();
  });
});

describe('patient language', () => {
  it('defaults from location, then the onboarding default, then the country', () => {
    expect(defaultPatientLanguage({ country: 'NG', region: 'Kano' })).toBe('ha');
    expect(defaultPatientLanguage({ country: 'NG', region: 'Lagos' })).toBe('yo');
    expect(defaultPatientLanguage({ country: 'NG', region: 'Enugu State' })).toBe('ig');
    expect(defaultPatientLanguage({ country: 'KE', region: 'Kisumu' })).toBe('luo');
    expect(defaultPatientLanguage({ country: 'GH', region: 'Northern' })).toBe('dag');
    expect(defaultPatientLanguage({ country: 'NG', region: 'Nowhere' }, 'ha')).toBe('ha');
    expect(defaultPatientLanguage({ country: 'KE', region: 'Nowhere' })).toBe('sw');
    expect(defaultPatientLanguage({ country: 'NG', region: 'Kano', language: 'en' })).toBe('en');
    expect(defaultPatientLanguage(undefined, 'sw')).toBe('sw');
    expect(defaultPatientLanguage(undefined)).toBe('en');
  });
});
