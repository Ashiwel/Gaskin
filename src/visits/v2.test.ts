import { describe, expect, it } from 'vitest';
import type { ConstraintEvent } from '../types';
import { makeMother } from '../engine/fixtures.test-helpers';
import { buildPlan } from '../engine';
import { activeItems, buildVisitChecklist, checklistToEvents, EPDS_ITEMS, EPDS_PLAIN, EPDS_WORDING_NOTE, summariseChecklist } from './index';
import type { ChecklistResult } from './types';

const T = '2026-11-05';
const preg = () => makeMother({ pregnancy: { lmp: '2026-04-23', fetuses: 1 }, events: [{ id: 'v1', kind: 'visit', at: '2026-07-20T09:00:00Z', recordedBy: 'w1', visitType: 'anc', attended: true }] }); // 28 weeks, booked
const r = (itemId: string, x: Omit<ChecklistResult, 'itemId'>): [string, ChecklistResult] => [itemId, { itemId, ...x }];

describe('conditional follow-ups', () => {
  it('a No on iron opens "What gets in the way?", and side effects open which-and-how-bad', () => {
    const cl = buildVisitChecklist(preg(), T);
    const q = cl.items.find((i) => i.baseId === 'a.adherence')!;
    expect(q.followUps?.[0].when.answerIn).toEqual(['no']);
    expect(activeItems(cl, {}).some((i) => i.baseId === 'a.adherence.fu.why')).toBe(false);
    const res1 = Object.fromEntries([r(q.id, { status: 'no' })]);
    const why = activeItems(cl, res1).find((i) => i.baseId === 'a.adherence.fu.why')!;
    expect(why.input.kind === 'choice' && why.input.options.map((o) => o.value)).toEqual(expect.arrayContaining(['cannot_afford', 'side_effects', 'forgets', 'not_available', 'declined']));
    const res2 = Object.fromEntries([...Object.entries(res1), r(why.id, { status: 'value', choice: 'side_effects' })]);
    const open = activeItems(cl, res2).map((i) => i.baseId);
    expect(open).toEqual(expect.arrayContaining(['a.adherence.fu.why.fu.se_symptoms', 'a.adherence.fu.why.fu.se_severity']));
  });

  it('answers become a ConstraintEvent with side-effect details, and the plan responds', () => {
    const cl = buildVisitChecklist(preg(), T);
    const results: Record<string, ChecklistResult> = Object.fromEntries([
      r('a.adherence', { status: 'no' }),
      r('a.adherence.fu.why', { status: 'value', choice: 'side_effects' }),
      r('a.adherence.fu.why.fu.se_symptoms', { status: 'value', choices: ['nausea', 'constipation'] }),
      r('a.adherence.fu.why.fu.se_severity', { status: 'value', choice: 'mild' }),
    ]);
    const events = checklistToEvents(cl, results, 'w-ng-bisola', T);
    const c = events.find((e): e is ConstraintEvent => e.kind === 'constraint')!;
    expect(c).toMatchObject({ itemId: 'med.iron_folate', reason: 'side_effects', recordedBy: 'w-ng-bisola', sideEffect: { symptoms: ['nausea', 'constipation'], severity: 'mild' } });
    const m = preg();
    m.events.push(...events);
    const p = buildPlan(m, T, { overrides: [], learnedRules: [] });
    expect(p.items.some((i) => i.id === 'alt.med.iron_folate.side_effects')).toBe(true);
  });

  it('declined asks why and records declinedReason', () => {
    const cl = buildVisitChecklist(preg(), T);
    const results = Object.fromEntries([r('a.adherence', { status: 'no' }), r('a.adherence.fu.why', { status: 'value', choice: 'declined' }), r('a.adherence.fu.why.fu.declined_why', { status: 'value', choice: 'religious_or_cultural' })]);
    const c = checklistToEvents(cl, results, 'w1', T).find((e): e is ConstraintEvent => e.kind === 'constraint')!;
    expect(c).toMatchObject({ reason: 'declined', declinedReason: 'religious_or_cultural' });
  });

  it('follow-ups exist for ANC attendance, diet, transport and every vaccine', () => {
    const cl = buildVisitChecklist(preg(), T);
    for (const b of ['a.anc_missed', 'a.diet', 'a.transport']) expect(cl.items.find((i) => i.baseId === b)?.followUps?.length, b).toBeGreaterThan(0);
    const child = makeMother({ children: [{ id: 'c1', name: 'Ada', sex: 'F', dob: '2026-09-20', birthWeightKg: 3, gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding' }] });
    const vc = buildVisitChecklist(child, T);
    const vaccines = vc.items.filter((i) => i.baseId.startsWith('d.vaccine.'));
    expect(vaccines.length).toBeGreaterThan(0);
    for (const v of vaccines) expect(v.constraintTarget, v.id).toMatch(/^imm\./);
    for (const v of vaccines) expect(v.followUps?.[0].when.answerIn).toEqual(['not_done']);
  });
});

describe('tests that cannot be done', () => {
  it('test items are marked, and Not available / Declined / Not done today become constraints, never results', () => {
    const cl = buildVisitChecklist(preg(), T);
    const up = cl.items.find((i) => i.baseId === 'd.urine_protein')!;
    expect(up.isTest).toBe(true);
    const events = checklistToEvents(cl, Object.fromEntries([r(up.id, { status: 'not_done_today' })]), 'w1', T);
    expect(events.some((e) => e.kind === 'lab')).toBe(false);
    expect(events.find((e) => e.kind === 'constraint')).toMatchObject({ itemId: 'test.urine_protein', reason: 'not_available', temporary: true });
  });

  it('the summary flags unknown tests, and refers today when BP is raised with no urine result', () => {
    const cl = buildVisitChecklist(preg(), T);
    const bp = cl.items.find((i) => i.input.kind === 'bp')!;
    const up = cl.items.find((i) => i.baseId === 'd.urine_protein')!;
    const s = summariseChecklist(cl, Object.fromEntries([r(bp.id, { status: 'value', value: 150, value2: 96 }), r(up.id, { status: 'not_available' })]));
    const u = s.unknowns.find((x) => x.itemId === up.id)!;
    expect(u).toMatchObject({ status: 'not_available', referToday: true });
    expect(s.recommendations.some((x) => /urine protein/i.test(x.text))).toBe(true);
    const normal = summariseChecklist(cl, Object.fromEntries([r(bp.id, { status: 'value', value: 110, value2: 70 }), r(up.id, { status: 'not_available' })]));
    expect(normal.unknowns.find((x) => x.itemId === up.id)?.referToday).toBe(false);
  });
});

describe('summariseChecklist', () => {
  it('returns abnormal, rechecks, unanswered (important flagged), recommendations with guides, and per-child counts', () => {
    const cl = buildVisitChecklist(preg(), T);
    const pallor = cl.items.find((i) => i.baseId === 'm.pallor')!;
    const s = summariseChecklist(cl, Object.fromEntries([r(pallor.id, { status: 'abnormal' })]));
    expect(s.abnormal.some((f) => f.baseId === 'm.pallor')).toBe(true);
    expect(s.rechecks.some((x) => x.itemId === pallor.id)).toBe(true);
    expect(s.unanswered.length).toBeGreaterThan(5);
    expect(s.unanswered.some((x) => x.important)).toBe(true);
    expect(s.unanswered.some((x) => !x.important)).toBe(true);
    expect(s.recommendations.some((x) => x.guideId)).toBe(true);
    expect(s.perChild).toEqual([]);
  });

  it('tell items carry how-to steps', () => {
    const cl = buildVisitChecklist(preg(), T);
    const tells = cl.items.filter((i) => i.section === 'tell');
    expect(tells.filter((i) => i.howTo?.steps.length).length).toBeGreaterThan(tells.length / 2);
  });
});

describe('EPDS wording', () => {
  it('plain questions address the mother, keep the scores, and the standard wording is kept', () => {
    expect(EPDS_PLAIN).toHaveLength(10);
    for (const [i, it] of EPDS_PLAIN.entries()) {
      expect(it.ask).toMatch(/^In the last 7 days, .*you/);
      expect(it.opts.map((o) => o[1])).toEqual(EPDS_ITEMS[i].opts.map((o) => o[1]));
      expect(it.standard).toBe(EPDS_ITEMS[i].q);
    }
    expect(EPDS_WORDING_NOTE).toMatch(/validat/);
  });
});
