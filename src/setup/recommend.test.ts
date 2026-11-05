import { describe, expect, it } from 'vitest';
import { recommendSetup, planChannels } from './recommend';
import { visibleQuestions, QUESTIONS } from './questions';
import type { SetupAnswers } from './types';

const NOW = '2026-11-05T09:00:00.000Z';

/** CHEW in Cross River with an old Windows laptop and patchy 3G */
const crossRiverChew: SetupAnswers = {
  workerLanguage: 'en',
  role: 'chew',
  country: 'NG',
  region: 'Cross River',
  district: 'Ikom',
  mothersLanguages: ['en', 'pcm'],
  devices: ['laptop', 'basic_phone'],
  computerOs: 'windows_old',
  internet: 'patchy',
  dataBudget: 'tiny',
  electricity: 'some_hours',
  printer: 'lga_office',
  aiApps: ['none'],
  caseload: '50_150',
  setupBy: 'supervisor',
  techComfort: 2,
};

/** Midwife in China, at ease with AI, fast internet */
const chinaMidwife: SetupAnswers = {
  workerLanguage: 'zh',
  role: 'midwife',
  country: 'other',
  countryOther: 'China',
  region: 'Yunnan',
  mothersLanguages: ['not_sure'],
  devices: ['android_phone', 'laptop'],
  computerOs: 'macos',
  internet: 'wifi',
  dataBudget: 'large',
  electricity: 'reliable',
  printer: 'own',
  aiApps: ['deepseek', 'chatgpt'],
  aiPay: 'me',
  caseload: '20_50',
  setupBy: 'myself',
  techComfort: 4,
};

/** Lagos midwife with a smartphone and WhatsApp */
const lagosMidwife: SetupAnswers = {
  workerLanguage: 'en',
  role: 'midwife',
  country: 'NG',
  region: 'Lagos',
  mothersLanguages: ['yo', 'en', 'pcm'],
  devices: ['android_phone'],
  internet: 'fourg',
  dataBudget: 'medium',
  electricity: 'some_hours',
  printer: 'facility',
  aiApps: ['meta_ai'],
  aiPay: 'free_only',
  caseload: '50_150',
  setupBy: 'myself',
  techComfort: 3,
};

/** Kano CHIPS agent with a shared basic phone and no internet */
const kanoChips: SetupAnswers = {
  workerLanguage: 'ha',
  role: 'chips_agent',
  country: 'NG',
  region: 'Kano',
  mothersLanguages: ['ha', 'ff'],
  devices: ['shared_basic_phone'],
  internet: 'none',
  electricity: 'rarely',
  printer: 'none',
  aiApps: ['none'],
  caseload: '20_50',
  setupBy: 'programme',
  techComfort: 1,
};

/** Kenyan CHP in Kisumu with a government eCHIS phone */
const kisumuChp: SetupAnswers = {
  workerLanguage: 'sw',
  role: 'chp',
  country: 'KE',
  region: 'Kisumu',
  mothersLanguages: ['luo', 'sw'],
  devices: ['work_phone', 'basic_phone'],
  internet: 'patchy',
  dataBudget: 'small',
  electricity: 'some_hours',
  printer: 'none',
  aiApps: ['none'],
  caseload: '50_150',
  setupBy: 'programme',
  techComfort: 3,
};

/** Ghanaian CHO in Upper East with a facility printer */
const upperEastCho: SetupAnswers = {
  workerLanguage: 'en',
  role: 'cho',
  country: 'GH',
  region: 'Upper East',
  district: 'Bongo',
  mothersLanguages: ['not_sure'],
  devices: ['work_phone'],
  internet: 'patchy',
  dataBudget: 'small',
  electricity: 'some_hours',
  printer: 'facility',
  aiApps: ['chatgpt'],
  aiPay: 'free_only',
  caseload: '50_150',
  setupBy: 'supervisor',
  techComfort: 2,
};

describe('recommendSetup personas', () => {
  it('Cross River CHEW, old Windows laptop, patchy 3G: USB stick, folder storage, no AI, Pidgin, LGA printing', () => {
    const p = recommendSetup(crossRiverChew, { folderAccess: true }, NOW);
    expect(p.run.where).toBe('laptop_usb');
    expect(p.run.reason).toMatch(/older Windows/);
    expect(p.storage.mode).toBe('folder');
    expect(p.storage.label).toMatch(/USB stick/);
    expect(p.ai.mode).toBe('none');
    expect(p.ai.settings).toEqual({ mode: 'none' });
    expect(p.ai.deidentify).toBe(true);
    expect(p.languages.install).toEqual(['pcm']);
    expect(p.languages.notes.join(' ')).toMatch(/Efik/);
    expect(p.printing.where).toBe('lga_office');
    expect(p.printing.routine).toMatch(/LGA office/);
    expect(planChannels(p)[0]).toBe('sms');
    expect(p.channels.some((c) => c.channel === 'voice')).toBe(true);
    expect(p.sync.method).toBe('usb_copy');
    expect(p.locationProfileId).toBe('NG-cross-river');
    expect(p.district).toBe('Ikom');
    expect(p.firstTenMinutes.length).toBeGreaterThanOrEqual(5);
    expect(p.firstTenMinutes.length).toBeLessThanOrEqual(10);
    expect(p.firstTenMinutes.join(' ')).toMatch(/USB stick/);
  });

  it('China, AI-confident, fast internet: own DeepSeek key, Chinese noted, WhatsApp-style first, WHO caveat', () => {
    const p = recommendSetup(chinaMidwife, { folderAccess: true, webgpu: true }, NOW);
    expect(p.country).toBe('other');
    expect(p.countryName).toBe('China');
    expect(p.locationProfileId).toBeNull();
    expect(p.run.where).toBe('laptop_browser');
    expect(p.storage.mode).toBe('folder');
    expect(p.ai.mode).toBe('own_key');
    expect(p.ai.needsKey?.service).toBe('DeepSeek');
    expect(p.ai.settings.ownKey?.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(p.ai.fallback).toBe('any_app');
    expect(p.languages.worker).toBe('zh');
    expect(p.languages.ui).toBe('en');
    expect(p.languages.notes.join(' ')).toMatch(/Chinese/);
    expect(p.notes.join(' ')).toMatch(/WeChat/);
    expect(p.notes.join(' ')).toMatch(/WHO/);
    expect(p.printing.where).toBe('own');
  });

  it('Lagos midwife, smartphone, Meta AI in WhatsApp: phone app, copy and paste AI, WhatsApp first', () => {
    const p = recommendSetup(lagosMidwife, {}, NOW);
    expect(p.run.where).toBe('phone_app');
    expect(p.storage.mode).toBe('browser');
    expect(p.ai.mode).toBe('any_app');
    expect(p.ai.label).toMatch(/Meta AI in WhatsApp/);
    expect(planChannels(p)[0]).toBe('whatsapp');
    expect(p.languages.install).toEqual(['yo', 'pcm']);
    expect(p.printing.where).toBe('facility');
    expect(p.firstTenMinutes.join(' ')).toMatch(/Copy the request/);
  });

  it('Kano CHIPS agent, shared basic phone, no internet: facility hub, SMS and voice, Hausa and Fulfulde, no AI', () => {
    const p = recommendSetup(kanoChips, {}, NOW);
    expect(p.run.where).toBe('facility_hub');
    expect(p.ai.mode).toBe('none');
    expect(p.ai.reason).toMatch(/no internet/);
    expect(p.languages.ui).toBe('ha');
    expect(p.languages.install).toEqual(['ha', 'ff']);
    expect(planChannels(p)).toEqual(['sms', 'whatsapp', 'voice']);
    expect(p.printing.where).toBe('none');
    expect(p.notes.join(' ')).toMatch(/Power is scarce/);
    expect(p.notes.join(' ')).toMatch(/malaria/);
    expect(p.storage.backupEveryDays).toBe(1);
  });

  it('Kenyan CHP with an eCHIS phone: phone app beside eCHIS, Dholuo and Kiswahili, IPTp zone', () => {
    const p = recommendSetup(kisumuChp, {}, NOW);
    expect(p.run.where).toBe('phone_app');
    expect(p.run.label).toMatch(/work phone/);
    expect(p.sync.method).toBe('echis_alongside');
    expect(p.sync.routine).toMatch(/eCHIS/);
    expect(p.languages.ui).toBe('sw');
    expect(p.languages.install).toEqual(['sw', 'luo']);
    expect(p.ai.mode).toBe('none');
    expect(p.locationProfileId).toBe('KE-kisumu');
    expect(planChannels(p)[0]).toBe('sms');
  });

  it('Ghanaian CHO in Upper East with a facility printer: phone, ChatGPT copy and paste, print at facility, voice', () => {
    const p = recommendSetup(upperEastCho, {}, NOW);
    expect(p.run.where).toBe('phone_app');
    expect(p.ai.mode).toBe('any_app');
    expect(p.ai.label).toMatch(/ChatGPT/);
    expect(p.printing.where).toBe('facility');
    expect(p.channels.map((c) => c.channel)).toEqual(['sms', 'whatsapp', 'voice', 'print']);
    expect(p.locationProfileId).toBe('GH-upper-east');
    // "Not sure" about mothers' languages: use the area's most spoken languages
    expect(p.languages.mothers.length).toBeGreaterThan(0);
    expect(p.languages.notes.join(' ')).toMatch(/Gurene/);
  });
});

describe('recommendSetup rules', () => {
  it('everything "Not sure" still gives a complete, safe plan', () => {
    const p = recommendSetup({ country: 'not_sure', devices: ['none'] }, {}, NOW);
    expect(p.run.where).toBe('facility_hub');
    expect(p.ai.mode).toBe('none');
    expect(p.channels[0].channel).toBe('sms');
    expect(p.firstTenMinutes.length).toBeGreaterThan(3);
  });

  it('inside the Claude app with internet, Claude is used with no setup', () => {
    const p = recommendSetup({ ...lagosMidwife }, { inClaude: true }, NOW);
    expect(p.ai.mode).toBe('claude_here');
    expect(p.ai.settings).toEqual({ mode: 'claude_here' });
  });

  it('a Claude user on her own laptop is offered the Claude Desktop connector', () => {
    const p = recommendSetup({ ...chinaMidwife, country: 'NG', countryOther: undefined, region: 'Lagos', aiApps: ['claude'], aiPay: 'free_only', devices: ['laptop'], computerOs: 'windows' }, {}, NOW);
    expect(p.ai.mode).toBe('connect_assistant');
    expect(p.ai.assistant).toBe('claude_desktop');
    expect(p.ai.settings.mode).toBe('any_app');
  });

  it('WebGPU laptop with Wi-Fi and steady power gets an in-browser model with de-identification on', () => {
    const p = recommendSetup({ country: 'GH', region: 'Greater Accra', role: 'midwife', devices: ['laptop'], computerOs: 'windows', internet: 'wifi', electricity: 'reliable', aiApps: ['none'], techComfort: 3 }, { webgpu: true, folderAccess: true }, NOW);
    expect(p.ai.mode).toBe('on_device');
    expect(p.ai.settings.onDevice?.deidentify).toBe(true);
  });

  it('no folder access (Firefox, Safari) on a USB stick falls back to backup files', () => {
    const p = recommendSetup(crossRiverChew, { folderAccess: false }, NOW);
    expect(p.storage.mode).toBe('file');
  });

  it('Turkana is outside the IPTp zone and the plan says so', () => {
    const p = recommendSetup({ ...kisumuChp, region: 'Turkana', mothersLanguages: ['not_sure'] }, {}, NOW);
    expect(p.notes.join(' ')).toMatch(/outside Kenya's IPTp zones/);
  });
});

describe('questions', () => {
  it('has 12 to 16 questions, each single/multi question with a Not sure or None choice', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(12);
    expect(QUESTIONS.length).toBeLessThanOrEqual(16);
    for (const q of QUESTIONS) {
      if (q.id === 'workerLanguage') continue;
      const opts = q.options({ country: 'NG' }).map((o) => o.value);
      expect(opts.includes('not_sure') || opts.includes('none') || q.kind === 'location', q.id).toBe(true);
    }
  });

  it('branches: computer type only with a computer, data budget only with internet, AI payment only for AI users', () => {
    const ids = (a: SetupAnswers) => visibleQuestions(a).map((q) => q.id);
    expect(ids({ devices: ['android_phone'] })).not.toContain('computerOs');
    expect(ids({ devices: ['laptop'] })).toContain('computerOs');
    expect(ids({ internet: 'none' })).not.toContain('dataBudget');
    expect(ids({ aiApps: ['none'] })).not.toContain('aiPay');
    expect(ids({ aiApps: ['chatgpt'] })).toContain('aiPay');
  });

  it('role options follow the country', () => {
    const role = QUESTIONS.find((q) => q.id === 'role')!;
    expect(role.options({ country: 'KE' }).map((o) => o.value)).toContain('chp');
    expect(role.options({ country: 'GH' }).map((o) => o.value)).toContain('cho');
    expect(role.options({ country: 'NG' }).map((o) => o.value)).toContain('chips_agent');
  });
});
