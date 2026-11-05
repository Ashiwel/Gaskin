import { describe, expect, it } from 'vitest';
import { triageSymptoms } from './triage';

describe('triageSymptoms', () => {
  it('puts danger signs first', () => {
    expect(triageSymptoms(['severe_headache', 'swelling_face_hands'])).toBe('emergency');
    expect(triageSymptoms(['baby_fast_breathing'])).toBe('emergency');
  });
  it('sends fever and low mood to same-day review', () => {
    expect(triageSymptoms(['fever'])).toBe('same_day');
    expect(triageSymptoms(['low_mood'])).toBe('same_day');
  });
  it('leaves minor or no symptoms for the next contact', () => {
    expect(triageSymptoms(['heartburn'])).toBe('next_contact');
    expect(triageSymptoms([])).toBe('next_contact');
    expect(triageSymptoms(undefined)).toBe('next_contact');
  });
});
