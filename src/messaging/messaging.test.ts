import { describe, expect, it } from 'vitest';
import { chooseChannel, composeFallbackMessage, estimateCost, parseSymptomsFromText, smsSegments } from './index';
import { COUNTRIES, createSeedState } from '../data';
import { buildPlan } from '../engine';
import type { Mother } from '../types';

const seed = createSeedState();
const mother = (id: string) => seed.mothers.find((m) => m.id === id)!;

describe('smsSegments', () => {
  it('handles GSM-7 boundaries', () => {
    expect(smsSegments('')).toBe(0);
    expect(smsSegments('a')).toBe(1);
    expect(smsSegments('a'.repeat(160))).toBe(1);
    expect(smsSegments('a'.repeat(161))).toBe(2);
    expect(smsSegments('a'.repeat(306))).toBe(2);
    expect(smsSegments('a'.repeat(307))).toBe(3);
  });
  it('counts extension characters twice', () => {
    expect(smsSegments('€'.repeat(80))).toBe(1);
    expect(smsSegments('€'.repeat(81))).toBe(2);
  });
  it('switches to UCS-2 for Hausa, Yoruba and Twi letters', () => {
    expect(smsSegments('ƙ' + 'a'.repeat(69))).toBe(1);
    expect(smsSegments('ƙ' + 'a'.repeat(70))).toBe(2);
    expect(smsSegments('ẹ' + 'a'.repeat(133))).toBe(2);
    expect(smsSegments('ẹ' + 'a'.repeat(134))).toBe(3);
    expect(smsSegments('Me yafunu yɛ me')).toBe(1);
    expect(smsSegments('Ẹ kú àárọ̀')).toBe(1);
  });
});

describe('chooseChannel', () => {
  const base = mother('m-ng-adaeze');
  const variant = (p: Partial<Mother>): Mother => ({ ...base, ...p, consent: { ...base.consent, preferredChannel: undefined, ...(p.consent ?? {}) } });
  it('smartphone with WhatsApp → whatsapp', () => {
    const r = chooseChannel(variant({ phone: { access: 'smartphone', hasWhatsApp: true, number: '+234 800 000 0101' } }), COUNTRIES.NG);
    expect(r.channel).toBe('whatsapp');
    expect(r.reason).toMatch(/WhatsApp/);
  });
  it('feature or shared phone → sms', () => {
    expect(chooseChannel(variant({ phone: { access: 'feature', hasWhatsApp: false } }), COUNTRIES.NG).channel).toBe('sms');
    expect(chooseChannel(variant({ phone: { access: 'shared', hasWhatsApp: false } }), COUNTRIES.NG).reason).toMatch(/shares/);
  });
  it('cannot read → sms with voice and print offered', () => {
    const r = chooseChannel(mother('m-ng-hauwa'), COUNTRIES.NG);
    expect(r.channel).toBe('sms');
    expect(r.alternatives.slice(0, 2)).toEqual(['voice', 'print']);
    expect(r.reason).toMatch(/cannot read/);
  });
  it('no phone → print via worker', () => {
    expect(chooseChannel(mother('m-gh-abiba'), COUNTRIES.GH).channel).toBe('print');
  });
  it('respects a usable preferred channel and ignores an unusable one', () => {
    expect(chooseChannel(mother('m-ng-omolara'), COUNTRIES.NG).channel).toBe('email');
    const r = chooseChannel(variant({ phone: { access: 'feature', hasWhatsApp: false }, consent: { ...base.consent, preferredChannel: 'whatsapp' } }), COUNTRIES.NG);
    expect(r.channel).toBe('sms');
  });
});

describe('estimateCost', () => {
  it('prices SMS per segment in local currency and USD', () => {
    const c = estimateCost('sms', 'a'.repeat(200), COUNTRIES.NG);
    expect(c.units).toBe(2);
    expect(c.local).toBeCloseTo(4.3, 4);
    expect(c.usd).toBeGreaterThan(0);
    expect(estimateCost('whatsapp', 'hello', COUNTRIES.KE).usd).toBeCloseTo(0.0067, 4);
  });
});

describe('composeFallbackMessage', () => {
  const m = mother('m-ng-hauwa');
  const plan = buildPlan(m, seed.clock, { overrides: seed.overrides, learnedRules: seed.learnedRules });
  it('keeps SMS to 3 segments and signs with the facility', () => {
    const sms = composeFallbackMessage(plan, m, { channel: 'sms', language: 'en' });
    expect(smsSegments(sms)).toBeLessThanOrEqual(3);
    expect(sms).toContain('Gwale Primary Health Centre');
    expect(sms.startsWith('Hello Hauwa')).toBe(true);
  });
  it('writes Pidgin from the Pidgin pack', () => {
    const pcm = composeFallbackMessage(plan, m, { channel: 'whatsapp', language: 'pcm' });
    expect(pcm).toMatch(/how you dey/);
  });
  it('falls back to plain English for languages without a pack', () => {
    const ha = composeFallbackMessage(plan, m, { channel: 'sms', language: 'ha' });
    expect(ha.startsWith('Hello Hauwa')).toBe(true);
    expect(ha).not.toMatch(/\bIPTp\b|\bhaemoglobin\b/i);
  });
  it('puts the top alert first', () => {
    const fake = { ...plan, alerts: [{ id: 'x', level: 'emergency' as const, title: 't', action: 'a', reason: 'r', sources: [], subject: 'mother' as const }] };
    expect(composeFallbackMessage(fake, m, { channel: 'whatsapp', language: 'en' }).split('\n')[1]).toMatch(/^URGENT/);
  });
});

describe('parseSymptomsFromText', () => {
  it.each([
    ['head dey bang me', ['severe_headache']],
    ['My head dey bang me well well and my leg don swell', ['severe_headache', 'swelling_face_hands']],
    ['blood dey comot for my private part', ['vaginal_bleeding']],
    ['my belle dey pain me', ['severe_abdominal_pain']],
    ['pikin no dey suck since morning', ['baby_not_feeding']],
    ['the baby dey breathe fast and body dey hot', ['baby_fever', 'baby_fast_breathing']],
    ['pikin no dey move for my belle since yesterday', ['reduced_fetal_movement']],
    ['my eye dey blur', ['blurred_vision']],
    ['I no fit sleep and my mind dey heavy', ['low_mood', 'insomnia']],
    ['water don break', ['leaking_fluid']],
    ['Ina ciwon kai', ['severe_headache']],
    ['Nina maumivu ya kichwa', ['severe_headache']],
    ['Breast milk no dey come well', ['low_milk_supply']],
  ])('%s', (text, expected) => {
    expect(parseSymptomsFromText(text).sort()).toEqual([...expected].sort());
  });
  it('does not read "no fit" as fits', () => {
    expect(parseSymptomsFromText('I no fit chop rice at all')).not.toContain('convulsions');
  });
  it('flags self-harm', () => {
    expect(parseSymptomsFromText('sometimes I feel like I wan die')).toContain('thoughts_of_self_harm');
  });
  it('returns nothing for small talk', () => {
    expect(parseSymptomsFromText('Thank you ma, I will come on Thursday')).toEqual([]);
  });
});
