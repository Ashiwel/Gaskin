import { describe, expect, it } from 'vitest';
import {
  AREA_COUNTRIES,
  CURATED_AREAS,
  NO_PACK_NOTE,
  PACK_STATE_LABELS,
  allLanguages,
  countryName,
  findCountry,
  findRegion,
  languagesFor,
  listAreasSync,
  listCountries,
  listRegions,
  loadAreas,
  malariaDefault,
  packFor,
  packStateFor,
  placeWords,
  searchCountries,
  searchLanguages,
} from '.';
import { getLocationProfile, hasCuratedProfile } from '../location';
import { defaultPatientLanguage, motherLanguageInfo, PACKS } from '../i18n';
import { recommendSetup } from '../setup/recommend';
import { visibleQuestions, QUESTIONS, PERSONAL_QUESTIONS, countryAnswer, regionAnswer, answerPlace } from '../setup/questions';
import { LOCAL_FOODS, TRADITIONAL_PRACTICES } from '../clinical';

/** Languages that are Nigerian, Kenyan or Ghanaian and not spoken in South Africa */
const WEST_AND_EAST_AFRICAN = ['ha', 'yo', 'ig', 'pcm', 'ff', 'fuv', 'bin', 'urh', 'tiv', 'efi', 'ibb', 'kr', 'shu', 'tw', 'ak', 'ee', 'dag', 'gaa', 'luo', 'ki', 'kam', 'luy'];

describe('countries and regions', () => {
  it('lists every ISO 3166-1 country, Nigeria, Ghana and Kenya first', () => {
    const all = listCountries();
    expect(all.length).toBe(249);
    expect(all.slice(0, 3).map((c) => c.code)).toEqual(['NG', 'GH', 'KE']);
    const za = all.find((c) => c.code === 'ZA')!;
    expect(za).toMatchObject({ name: 'South Africa', callingCode: '27', currency: 'ZAR' });
    expect(all.find((c) => c.code === 'CI')!.nativeName).toMatch(/Côte d'Ivoire/);
  });

  it('finds countries by name, native name, alias or code', () => {
    expect(searchCountries('south af')[0].code).toBe('ZA');
    expect(searchCountries('ivory')[0].code).toBe('CI');
    expect(findCountry('DRC')?.code).toBe('CD');
    expect(findCountry('China')?.code).toBe('CN');
    expect(findCountry('za')?.code).toBe('ZA');
    expect(countryName('KE')).toBe('Kenya');
  });

  it('has first-level regions with the right counts: 37 Nigerian states with FCT, 47 counties, 16 Ghanaian regions, 9 provinces', () => {
    expect(listRegions('NG').length).toBe(37);
    expect(listRegions('KE').length).toBe(47);
    expect(listRegions('GH').length).toBe(16);
    expect(listRegions('ZA').length).toBe(9);
    expect(listRegions('GH').map((r) => r.name)).not.toContain('Brong-Ahafo'); // split in 2018
    expect(listRegions('FR').length).toBeGreaterThan(10);
  });

  it('matches regions by code, name with suffix, and alias', () => {
    expect(findRegion('NG', 'Enugu State')?.code).toBe('NG-EN');
    expect(findRegion('NG', 'FCT')?.code).toBe('NG-FC');
    expect(findRegion('KE', 'Kisumu County')?.code).toBe('KE-17');
    expect(findRegion('GH', 'Bolga')?.code).toBe('GH-UE');
    expect(findRegion('ZA', 'KZN')?.name).toBe('KwaZulu-Natal');
    expect(findRegion('ZA', 'ZA-GP')?.name).toBe('Gauteng');
    // 'Eastern' is a Ghanaian region, not a South African one
    expect(findRegion('ZA', 'Eastern')).toBeUndefined();
  });

  it('second-level areas: 774 LGAs, 290 sub-counties, 261 districts, 213 municipalities', async () => {
    expect(listAreasSync('NG', 'Lagos') === null || Array.isArray(listAreasSync('NG', 'Lagos'))).toBe(true);
    const counts: Record<string, number> = {};
    for (const c of AREA_COUNTRIES) counts[c] = (await loadAreas(c)).length;
    expect(counts).toEqual({ NG: 774, KE: 290, GH: 261, ZA: 213 });
    expect((await loadAreas('NG', 'Kano')).length).toBe(44);
    expect((await loadAreas('NG', 'Lagos')).length).toBe(20);
    expect((await loadAreas('NG', 'FCT')).length).toBe(6);
    expect((await loadAreas('GH', 'Ashanti')).length).toBe(43);
    expect((await loadAreas('KE', 'Nairobi')).length).toBe(17);
    expect((await loadAreas('ZA', 'Gauteng')).map((a) => a.name)).toContain('City of Johannesburg');
    expect(await loadAreas('FR', 'Bretagne')).toEqual([]); // no list: free text
    expect(placeWords('NG').areaShort).toBe('LGA');
  });
});

describe('languagesFor', () => {
  it('South Africa never offers Nigerian, Ghanaian or Kenyan languages', () => {
    const suggested = allLanguages({ country: 'ZA' }).filter((l) => l.from !== 'other');
    const lists = [languagesFor('ZA'), ...listRegions('ZA').map((r) => languagesFor('ZA', r.name)), suggested];
    for (const list of lists) {
      for (const l of list) expect(WEST_AND_EAST_AFRICAN, l.tag).not.toContain(l.tag);
    }
    const za = languagesFor('ZA').map((l) => l.tag);
    expect(za).toEqual(expect.arrayContaining(['zu', 'xh', 'af', 'en', 'nso', 'tn', 'st']));
    expect(languagesFor('ZA', 'KwaZulu-Natal')[0].tag).toBe('zu');
    expect(languagesFor('ZA', 'Western Cape')[0].tag).toBe('af');
  });

  it('follows the state in Nigeria', async () => {
    const tags = (r: string, a?: string) => languagesFor('NG', r, a).map((l) => l.tag);
    expect(tags('Kano').slice(0, 3)).toEqual(['ha', 'fuv', 'en']);
    expect(tags('Lagos').slice(0, 4)).toEqual(['yo', 'en', 'pcm', 'ig']);
    expect(tags('Edo')[0]).toBe('bin');
    expect(tags('Delta')).toEqual(expect.arrayContaining(['urh', 'iso', 'its', 'ukw', 'en', 'pcm']));
    expect(tags('Cross River')).toEqual(expect.arrayContaining(['efi', 'etu', 'bkv', 'en']));
    expect(tags('Borno').slice(0, 3)).toEqual(['kr', 'shu', 'ha']);
    expect(tags('Rivers')).toEqual(expect.arrayContaining(['ikw', 'ijc', 'ogo', 'pcm']));
    expect(tags('Benue').slice(0, 2)).toEqual(['tiv', 'idu']);
    expect(tags('Plateau')).toContain('bom');
    expect(tags('Kano')).not.toContain('yo');
    expect(tags('Lagos')).not.toContain('ha');
    // Area overrides: Isoko North, Otukpo (GRID3 spells it Oturkpo)
    await loadAreas('NG');
    expect(tags('Delta', 'Isoko North')[0]).toBe('iso');
    expect(tags('Benue', 'Oturkpo')[0]).toBe('idu');
  });

  it('follows the county in Kenya and the region in Ghana', () => {
    expect(languagesFor('KE', 'Kisumu')[0].tag).toBe('luo');
    expect(languagesFor('KE', 'Kiambu')[0].tag).toBe('ki');
    expect(languagesFor('KE', 'Turkana')[0].tag).toBe('tuv');
    expect(languagesFor('GH', 'Ashanti')[0].tag).toBe('tw');
    expect(languagesFor('GH', 'Volta')[0].tag).toBe('ee');
    expect(languagesFor('GH', 'Northern')[0].tag).toBe('dag');
    expect(languagesFor('GH', 'Upper East')[0].tag).toBe('gur');
    for (const code of [...listRegions('NG'), ...listRegions('KE'), ...listRegions('GH')].map((r) => r.code)) {
      expect(CURATED_AREAS[code], code).toBeTruthy();
      expect(CURATED_AREAS[code].source.length, code).toBeGreaterThan(10);
    }
  });

  it('always offers English, and French, Portuguese or Arabic where official; unknown country gives English', () => {
    for (const c of ['NG', 'KE', 'GH', 'ZA', 'CM', 'MZ', 'TD', 'CN', 'BR']) expect(languagesFor(c).map((l) => l.tag), c).toContain('en');
    expect(languagesFor('CM').map((l) => l.tag)).toContain('fr');
    expect(languagesFor('MZ')[0].tag).toBe('pt');
    expect(languagesFor('TD').map((l) => l.tag)).toEqual(expect.arrayContaining(['ar', 'fr']));
    expect(languagesFor('XX').map((l) => l.tag)).toEqual(['en']);
    expect(languagesFor(undefined).map((l) => l.tag)).toEqual(['en']);
  });

  it('accepts an object and the onboarding district alias', () => {
    expect(languagesFor({ country: 'NG', region: 'NG-KN' })[0].tag).toBe('ha');
    expect(languagesFor({ country: 'NG', region: 'Delta', district: 'Isoko South' })[0].tag).toBe('iso');
  });

  it('carries names, shares, official flags and pack states; languages with no pack say Coming soon', () => {
    const zu = languagesFor('ZA').find((l) => l.tag === 'zu')!;
    expect(zu).toMatchObject({ name: 'isiZulu', nativeName: 'isiZulu', packCode: 'zu', official: true });
    expect(zu.share).toBeGreaterThan(20);
    const nso = languagesFor('ZA').find((l) => l.tag === 'nso')!;
    expect(nso.pack).toBe('none');
    expect(nso.packCode).toBeUndefined();
    expect(nso.code).toBe('nso');
    expect(PACK_STATE_LABELS.none).toBe('Coming soon');
    expect(NO_PACK_NOTE).toMatch(/Coming soon/);
    const tiv = languagesFor('NG', 'Benue')[0];
    expect(tiv).toMatchObject({ tag: 'tiv', name: 'Tiv', pack: 'none' });
  });

  it('search finds languages by English or native name', () => {
    expect(searchLanguages('zulu')[0].tag).toBe('zu');
    expect(searchLanguages('isiXhosa')[0].tag).toBe('xh');
    expect(searchLanguages('tiv', { country: 'NG' })[0].tag).toBe('tiv');
    expect(searchLanguages('ndebele').map((l) => l.tag)).toEqual(expect.arrayContaining(['nd', 'nr']));
  });
});

describe('packFor', () => {
  it('maps BCP-47 tags and common aliases one to one onto packs', () => {
    expect(packFor('zu')).toBe('zu');
    expect(packFor('zu-ZA')).toBe('zu');
    expect(packFor('zul')).toBe('zu');
    expect(packFor('nya')).toBe('ny');
    expect(packFor('kin')).toBe('rw');
    expect(packFor('pt-MZ')).toBe('pt');
    expect(packFor('fr-CM')).toBe('fr');
    expect(packFor('fuv')).toBe('ff');
    expect(packFor('shu')).toBe('ar');
    expect(packFor('ak')).toBe('tw');
    expect(packFor('tiv')).toBeUndefined();
    expect(packFor('nso')).toBeUndefined();
    expect(packFor(undefined)).toBeUndefined();
  });

  it('reads pack state live from the registry', () => {
    for (const [code, pack] of Object.entries(PACKS)) {
      const want = code === 'en' ? 'reviewed' : pack.status === 'machine_draft' ? 'draft' : pack.status;
      expect(packStateFor(code), code).toBe(want);
    }
    expect(packStateFor('tiv')).toBe('none');
  });
});

describe('patient language', () => {
  it('new form gives a tag and pack for any country, never Pidgin, never another country', () => {
    expect(defaultPatientLanguage('ZA', 'KwaZulu-Natal')).toEqual({ tag: 'zu', packCode: 'zu', pack: packStateFor('zu') });
    expect(defaultPatientLanguage('ZA', 'Limpopo').tag).toBe('nso');
    expect(defaultPatientLanguage('ZA', 'Limpopo').packCode).toBeUndefined();
    expect(defaultPatientLanguage('NG', 'Kano')).toMatchObject({ tag: 'ha', packCode: 'ha' });
    expect(defaultPatientLanguage('NG', 'Rivers').tag).not.toBe('pcm');
    expect(defaultPatientLanguage('NG', 'Benue').tag).toBe('tiv');
    expect(defaultPatientLanguage('NG', 'Benue', undefined, { explicit: 'idu' }).tag).toBe('idu');
    expect(defaultPatientLanguage('XX').tag).toBe('en');
  });

  it('legacy form never returns a Nigerian language for South Africa', () => {
    const za = defaultPatientLanguage({ country: 'ZA', region: 'Eastern Cape' }, 'ha');
    expect(['ha', 'yo', 'ig', 'pcm']).not.toContain(za);
    // 'Eastern' and 'Northern' are Ghanaian regions; the region table must not leak across countries
    expect(defaultPatientLanguage({ country: 'ZA', region: 'Northern' })).not.toBe('dag');
    expect(defaultPatientLanguage({ country: 'GH', region: 'Northern' })).toBe('dag');
  });

  it('a mother recorded as speaking a language with no pack renders in plain English with a note', () => {
    expect(motherLanguageInfo({ language: 'en', languageTag: 'tiv' })).toMatchObject({ tag: 'tiv', render: 'en', pack: 'none' });
    expect(motherLanguageInfo({ language: 'en', languageTag: 'tiv' }).note).toMatch(/Coming soon/);
    expect(motherLanguageInfo({ language: 'en', languageTag: 'zu' }).render).toBe('zu');
    expect(motherLanguageInfo({ language: 'ha' })).toMatchObject({ tag: 'ha', render: 'ha' });
  });
});

describe('location profiles outside the launch countries', () => {
  it('South Africa gets a generic profile: no Nigerian languages, foods or practices', () => {
    for (const region of ['', 'Gauteng', 'KwaZulu-Natal', 'Eastern Cape', 'Lagos', 'Kano']) {
      const p = getLocationProfile('ZA', region);
      expect(p.country, region).toBe('ZA');
      expect(p.origin).toBe('generic');
      expect(p.localFoods).toEqual([]);
      expect(p.prevalentPractices).toEqual([]);
      expect(p.referralFacilities).toEqual([]);
      for (const l of p.languages) expect(WEST_AND_EAST_AFRICAN, `${region} ${l}`).not.toContain(l);
      const ngFoods = new Set(LOCAL_FOODS.NG.map((f) => f.name));
      expect(p.localFoods.some((f) => ngFoods.has(f.name))).toBe(false);
      const ngPractices = new Set(TRADITIONAL_PRACTICES.filter((t) => t.countries.includes('NG')).map((t) => t.id));
      expect(p.prevalentPractices.some((id) => ngPractices.has(id))).toBe(false);
      expect(p.otherLanguages.join(' ')).not.toMatch(/Hausa|Yoruba|Igbo|Pidgin/);
    }
    expect(getLocationProfile('ZA', 'KwaZulu-Natal').languages[0]).toBe('zu');
    expect(hasCuratedProfile('ZA', 'Lagos')).toBe(false);
  });

  it('uses WHO malaria defaults: IPTp in high-burden Africa, focal and no IPTp in South Africa, none in France', () => {
    expect(getLocationProfile('ZA', 'Limpopo')).toMatchObject({ malariaEndemic: false, malariaRisk: 'low' });
    expect(getLocationProfile('ZA', 'Limpopo').malariaNote).toMatch(/Limpopo/);
    expect(getLocationProfile('UG', '').malariaEndemic).toBe(true);
    expect(getLocationProfile('FR', '').malariaEndemic).toBe(false);
    expect(malariaDefault('MZ').iptp).toBe(true);
    expect(malariaDefault('ET')).toMatchObject({ iptp: false, endemic: true });
    expect(malariaDefault('GB').endemic).toBe(false);
  });

  it('launch countries still use their curated or country-default profiles', () => {
    expect(getLocationProfile('NG', 'Benue').id).toBe('NG-benue');
    expect(getLocationProfile('NG', 'Sokoto').origin).toBe('country_default');
  });
});

describe('onboarding with structured location', () => {
  it('South Africa end to end: questions, plan and languages carry no Nigerian language', () => {
    const answers = { audience: 'health_worker' as const, ...countryAnswer('ZA'), ...regionAnswer('ZA', 'KwaZulu-Natal'), district: 'eThekwini', mothersLanguages: ['not_sure' as const], devices: ['android_phone' as const] };
    expect(answers).toMatchObject({ country: 'other', countryCode: 'ZA', countryOther: 'South Africa', region: 'KwaZulu-Natal', regionCode: 'ZA-KZN' });
    const qs = visibleQuestions(answers);
    for (const q of qs) {
      if (q.id === 'workerLanguage' || q.id === 'mothersLanguages') {
        const values = q.options(answers).map((o) => String(o.value)).filter((v) => v !== 'other' && v !== 'not_sure');
        for (const v of values) expect(WEST_AND_EAST_AFRICAN, `${q.id} ${v}`).not.toContain(v);
        const place = q.place as Extract<NonNullable<typeof q.place>, { kind: 'language' }>;
        for (const l of place.top(answers)) expect(WEST_AND_EAST_AFRICAN).not.toContain(l.tag);
      }
    }
    const p = recommendSetup(answers, {}, '2026-11-06T00:00:00Z');
    expect(p.countryCode).toBe('ZA');
    expect(p.countryName).toBe('South Africa');
    expect(p.region).toBe('KwaZulu-Natal');
    expect(p.mode).toBe('worker');
    expect(p.languages.mothers[0]).toBe('zu');
    for (const l of [...p.languages.mothers, ...p.languages.install]) expect(WEST_AND_EAST_AFRICAN).not.toContain(l);
    for (const l of p.languages.motherLanguages ?? []) expect(WEST_AND_EAST_AFRICAN).not.toContain(l.tag);
    expect(p.notes.join(' ')).not.toMatch(/Nigerian/);
    expect(p.locationProfileId).toBeNull();
  });

  it('records languages with no pack as tags and says Coming soon', () => {
    const p = recommendSetup({ ...countryAnswer('ZA'), ...regionAnswer('ZA', 'Limpopo'), mothersLanguages: ['nso', 'ts', 'zu'] }, {}, '2026-11-06T00:00:00Z');
    expect(p.languages.motherLanguages?.map((l) => l.tag)).toEqual(['nso', 'ts', 'zu']);
    expect(p.languages.mothers).toEqual(['zu']);
    expect(p.languages.notes.join(' ')).toMatch(/Coming soon: Northern Sotho/);
  });

  it('a typed country name still resolves (older saved answers)', () => {
    const p = recommendSetup({ country: 'other', countryOther: 'South Africa', region: 'Gauteng', mothersLanguages: ['not_sure'] }, {}, '2026-11-06T00:00:00Z');
    expect(p.countryCode).toBe('ZA');
    expect(p.languages.mothers[0]).toBe('zu');
  });

  it('question flow: who first; personal use asks only what she needs; region and area lists come from src/geo', () => {
    expect(visibleQuestions({})[0].id).toBe('audience');
    const worker = visibleQuestions({ audience: 'health_worker', devices: ['laptop'] }).map((q) => q.id);
    expect(worker).toEqual(expect.arrayContaining(['country', 'location', 'workerLanguage', 'role', 'mothersLanguages', 'devices', 'computerOs']));
    expect(visibleQuestions({ audience: 'supervisor' }).map((q) => q.id)).not.toContain('role');
    const personal = visibleQuestions({ audience: 'personal' }).map((q) => q.id);
    expect(personal).toEqual(['audience', 'country', 'location', 'languageTag', 'personalStage', 'clinicRegistered', 'phone', 'internet']);
    expect(PERSONAL_QUESTIONS.length).toBeLessThan(QUESTIONS.length);
    const loc = QUESTIONS.find((q) => q.id === 'location')!;
    const za = { ...countryAnswer('ZA') };
    expect(loc.options(za).map((o) => o.value)).toContain('KwaZulu-Natal');
    expect(loc.area?.hasList(za)).toBe(true);
    expect(loc.area?.hasList(countryAnswer('FR'))).toBe(false);
    const country = QUESTIONS.find((q) => q.id === 'country')!;
    expect(country.options({}).slice(0, 3).map((o) => o.value)).toEqual(['NG', 'GH', 'KE']);
    expect(answerPlace({ ...countryAnswer('NG'), ...regionAnswer('NG', 'Kano') })).toMatchObject({ country: 'NG', region: 'NG-KN' });
  });

  it('language questions: worker screens need a pack, mothers may pick any language, "More languages" lists all', () => {
    const wl = QUESTIONS.find((q) => q.id === 'workerLanguage')!.place as Extract<NonNullable<(typeof QUESTIONS)[number]['place']>, { kind: 'language' }>;
    const ml = QUESTIONS.find((q) => q.id === 'mothersLanguages')!.place as typeof wl;
    const a = { ...countryAnswer('NG'), ...regionAnswer('NG', 'Benue') };
    expect(wl.top(a).every((l) => l.tag === 'en' || l.pack !== 'none')).toBe(true);
    expect(wl.top(a).map((l) => l.tag)).toContain('en');
    expect(ml.top(a)[0].tag).toBe('tiv');
    expect(ml.all(a).length).toBeGreaterThan(300);
    expect(ml.search(a, 'idoma')[0].tag).toBe('idu');
    expect(ml.labels.none).toBe('Coming soon');
  });

  it('personal mode: no caseload, AI off, nudges to register at a clinic, nearest facilities from the profile', () => {
    const p = recommendSetup({ audience: 'personal', ...countryAnswer('NG'), ...regionAnswer('NG', 'Benue'), languageTag: 'tiv', personalStage: ['pregnant'], clinicRegistered: 'no', phone: 'smartphone' }, { inClaude: true }, '2026-11-06T00:00:00Z');
    expect(p.mode).toBe('personal');
    expect(p.ai.mode).toBe('none');
    expect(p.run.where).toBe('phone_app');
    expect(p.storage.mode).toBe('browser');
    expect(p.personal?.nudges.join(' ')).toMatch(/antenatal care/);
    expect(p.personal?.nudges.join(' ')).toMatch(/not a doctor/);
    expect(p.personal?.nearestFacilities.length).toBeGreaterThan(0);
    expect(p.firstTenMinutes.join(' ')).toMatch(/health centre/);
    const za = recommendSetup({ audience: 'personal', ...countryAnswer('ZA'), clinicRegistered: 'yes' }, {}, '2026-11-06T00:00:00Z');
    expect(za.personal?.nearestFacilities).toEqual([]);
    expect(za.personal?.nudges.join(' ')).toMatch(/Ask at your nearest health centre/);
    expect(recommendSetup({ audience: 'supervisor', country: 'NG' }, {}, '2026-11-06T00:00:00Z').mode).toBe('supervisor');
    expect(recommendSetup({ country: 'NG' }, {}, '2026-11-06T00:00:00Z').mode).toBe('worker');
  });
});
