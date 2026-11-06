import { beforeEach, describe, expect, it } from 'vitest';
import { _clearStorage } from '../i18n/storage';
import { addCustomQuestion, CUSTOM_QUESTIONS_KEY, customQuestionStore, decodeCustomAnswers, deleteCustomQuestion, encodeCustomAnswers, listCustomQuestions } from './customQuestions';
import { renderVisitSheetHTML, visitSheetText } from '../illustrations/visitSheet';

describe('custom visit questions', () => {
  beforeEach(() => _clearStorage([CUSTOM_QUESTIONS_KEY]));

  it('adds, lists per worker or facility and visit type, and deletes', () => {
    let calls = 0;
    const off = customQuestionStore.subscribe(() => calls++);
    const mine = addCustomQuestion({ text: '  Is anyone helping you at night? ', visitType: 'pnc', answer: 'yes_no', scope: 'worker', ownerId: 'w1', createdBy: 'w1', createdAt: '2026-11-05T10:00:00Z' });
    addCustomQuestion({ text: 'Do you have a bed net?', visitType: 'anc', answer: 'yes_no', scope: 'facility', ownerId: 'f1', createdBy: 'w2', createdAt: '2026-11-05T11:00:00Z' });
    addCustomQuestion({ text: 'Someone else’s question', visitType: 'pnc', answer: 'text', scope: 'worker', ownerId: 'w9', createdBy: 'w9' });
    expect(mine.text).toBe('Is anyone helping you at night?');
    expect(listCustomQuestions({ workerId: 'w1', facilityId: 'f1', visitType: 'pnc' }).map((q) => q.text)).toEqual(['Is anyone helping you at night?']);
    expect(listCustomQuestions({ workerId: 'w1', facilityId: 'f1', visitType: 'anc' })).toHaveLength(1);
    expect(listCustomQuestions()).toHaveLength(3);
    expect(deleteCustomQuestion(mine.id)).toBe(true);
    expect(deleteCustomQuestion(mine.id)).toBe(false);
    expect(listCustomQuestions({ workerId: 'w1', facilityId: 'f1', visitType: 'pnc' })).toHaveLength(0);
    expect(calls).toBe(4);
    off();
    expect(() => addCustomQuestion({ text: '   ', visitType: 'anc', answer: 'text', scope: 'worker', ownerId: 'w1', createdBy: 'w1' })).toThrow();
  });

  it('round-trips answers through the visit note', () => {
    const q = addCustomQuestion({ text: 'Any trouble | at home?', visitType: 'anc', answer: 'text', scope: 'worker', ownerId: 'w1', createdBy: 'w1' });
    const note = `checklist:anc3|${encodeCustomAnswers([{ question: q, answer: 'Yes, rain -> leaks' }])}|done:`;
    const back = decodeCustomAnswers(note);
    expect(back).toHaveLength(1);
    expect(back[0].question).toBe('Any trouble | at home?');
    expect(back[0].answer).toContain('Yes, rain');
  });
});

describe('Next steps page', () => {
  const input = {
    name: 'Ngozi <b>',
    language: 'ig',
    visitDate: '2026-11-05',
    medicines: [{ name: 'Iron and folic acid', when: 'every night with food', perDay: 1 }],
    foods: [{ name: 'Beans', serving: 'a cup a day' }],
    todo: [{ title: 'Back exercises', steps: ['Kneel on hands and knees'] }],
    dangerSigns: [{ label: 'Bleeding', illustration: 'danger_bleeding' as const }],
    tests: [{ name: 'Urine protein', when: 'at your next visit' }],
    nextVisit: { date: '2026-11-19', place: 'Surulere PHC' },
    emergencyNumber: '112',
    workerName: 'Bisola',
    paper: 'Letter' as const,
  };
  it('is a self-contained, escaped page with no scripts', () => {
    const html = renderVisitSheetHTML(input);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('lang="ig"');
    expect(html).toContain('size: letter');
    expect(html).toContain('Ngozi &lt;b&gt;');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('Call 112');
    expect(html).toContain('Surulere PHC');
  });
  it('has a short message version', () => {
    const t = visitSheetText(input, 160);
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t).toMatch(/^Ngozi/);
  });
});
