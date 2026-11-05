import { describe, expect, it } from 'vitest';
import { validateAIText, filterSuggestions } from '../guardrails';
import { EMERGENCY_ALERT, mother, plan } from './fixtures';

describe('validateAIText', () => {
  const m = mother();

  it('passes a faithful message', () => {
    const p = plan(m);
    const r = validateAIText('Hello Adaeze, please take one ferrous sulphate 200 mg tablet and folic acid 400 mcg every day. See you at the clinic at 30 weeks.', p, m);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('catches an invented medicine and dose', () => {
    const p = plan(m);
    const r = validateAIText('Take ferrous sulphate 400 mg twice daily and also Coartem for any fever.', p, m);
    expect(r.ok).toBe(false);
    expect(r.issues.join('\n')).toMatch(/"400 mg"/);
    expect(r.issues.join('\n')).toMatch(/Coartem/);
  });

  it('catches "no need to go to the hospital" and a missing danger-sign line when there is an emergency alert', () => {
    const p = plan(m, {}, [EMERGENCY_ALERT]);
    const r = validateAIText('Dear Adaeze, a headache is common in pregnancy, so there is no need to go. Rest well.', p, m);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /no need to go/.test(i))).toBe(true);
    expect(r.issues.some((i) => /emergency alert/.test(i))).toBe(true);
  });

  it('flags "stop taking" even without alerts', () => {
    const r = validateAIText('You can stop taking your tablets now.', plan(m), m);
    expect(r.ok).toBe(false);
  });

  it('accepts a Pidgin emergency message that says go hospital', () => {
    const p = plan(m, {}, [EMERGENCY_ALERT]);
    const r = validateAIText('Adaeze, e dey urgent. Go hospital now now, no wait.', p, m);
    expect(r.ok).toBe(true);
  });
});

describe('filterSuggestions', () => {
  it('drops clinical suggestions', () => {
    const p = plan(mother());
    const { items, rejected } = filterSuggestions(
      [
        { title: 'Ask a relative to help', detail: 'Support', motherText: 'Ask your sister to help with cooking this week.', category: 'family_support' },
        { title: 'Take vitamin C', detail: 'Absorption', motherText: 'Take vitamin C 500 mg with your iron.', category: 'nutrition' },
      ],
      p,
    );
    expect(items.map((i) => i.title)).toEqual(['Ask a relative to help']);
    expect(rejected).toHaveLength(1);
  });
});
