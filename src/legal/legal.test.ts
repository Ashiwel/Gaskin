import { describe, expect, it } from 'vitest';
import { CONSENT_KEYS, CONSENT_VERSION, consentValid, DISCLAIMER_KEYS, EMERGENCY_NUMBERS, emergencyNumberFor, LEGAL_TEXT, renderLegal, TERMS_KEYS } from './index';
import { JARGON, sentences, wordCount } from '../engine/motherText.test';

describe('legal and personal use', () => {
  it('emergency numbers are sourced and dated; unverified ones are left out', () => {
    expect(emergencyNumberFor('NG')).toBe('112');
    expect(emergencyNumberFor('KE')).toBe('999 or 112');
    expect(emergencyNumberFor('GH')).toBe('112');
    expect(emergencyNumberFor('ZA')).toMatch(/10177/);
    expect(emergencyNumberFor('XX')).toBeUndefined();
    for (const e of Object.values(EMERGENCY_NUMBERS)) {
      expect(e.sources.length).toBeGreaterThan(0);
      expect(e.checkedAt).toBe('2026-11-05');
      for (const s of e.sources) expect(s.url).toMatch(/^https:\/\//);
    }
    // Ghana's 193 was retired in 2020; it is not offered.
    expect(EMERGENCY_NUMBERS.GH.numbers.map((n) => n.number)).not.toContain('193');
  });

  it('text is plain: short sentences, no jargon, placeholders fill', () => {
    for (const [k, t] of Object.entries(LEGAL_TEXT)) {
      expect(JARGON.test(t), k).toBe(false);
      for (const s of sentences(t)) expect(wordCount(s), `${k}: ${s}`).toBeLessThan(15);
    }
    for (const k of [...DISCLAIMER_KEYS, ...TERMS_KEYS, ...CONSENT_KEYS]) expect(LEGAL_TEXT[k], k).toBeTruthy();
    expect(renderLegal('legal.disclaimer.emergency', { number: '112' })).toBe('In an emergency, go to the nearest hospital now. Or call 112.');
  });

  it('consent needs every required box and the current version', () => {
    const ok = { version: CONSENT_VERSION, agreedAt: '2026-11-05', understandsNotDoctor: true, knowsEmergency: true, storeOnDevice: true, aiAllowed: false, adultOrGuardian: true };
    expect(consentValid(ok)).toBe(true);
    expect(consentValid({ ...ok, knowsEmergency: false })).toBe(false);
    expect(consentValid({ ...ok, version: '2025-01-01' })).toBe(false);
    expect(consentValid(null)).toBe(false);
  });
});
