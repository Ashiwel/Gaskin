import { describe, expect, it } from 'vitest';
import type { BirthEvent, Child, ConstraintEvent, FeedingEvent, ImmunisationEvent, SymptomEvent, VitalsEvent } from '../types';
import { buildPlan, deriveState } from './index';
import { ev, makeMother } from './fixtures.test-helpers';
import { createSeedState } from '../data';
import { buildVisitChecklist, checklistToEvents } from '../visits';

const T = '2026-11-05';
const ctx = { overrides: [], learnedRules: [] };
const kid = (id: string, name: string, dob: string, over: Partial<Child> = {}): Child => ({ id, name, sex: 'F', dob, birthWeightKg: 3.1, gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding', ...over });
const birth = (child: Child, mode: BirthEvent['birth']['mode'] = 'vaginal') => ev<BirthEvent>({ kind: 'birth', at: `${child.dob}T06:00:00Z`, birth: { date: child.dob, mode, place: 'facility', complications: ['none'] }, child });

describe('several children within the first 1,000 days', () => {
  it('pregnant at 20 weeks with a 10-month-old: concurrent stage, child kept, short interval risk', () => {
    const ebube = kid('c1', 'Ebube Eze', '2026-01-04', { feeding: 'complementary_with_breastmilk' });
    const m = makeMother({ children: [ebube], events: [birth(ebube)], pregnancy: { lmp: '2026-06-18', fetuses: 1 } });
    const s = deriveState(m, T);
    expect(s.stage).toBe('pregnancy');
    expect(s.concurrent).toBe(true);
    expect(s.infant?.id).toBe('c1');
    expect(s.children?.map((c) => c.childId)).toEqual(['c1']);
    expect(s.interpregnancyMonths).toBe(5);
    const r = s.risks.find((x) => x.code === 'short_birth_interval')!;
    expect(r.severity).toBe('high');
    expect(r.sources.map((x) => x.id)).toEqual(expect.arrayContaining(['who-birth-spacing-2005', 'conde-agudelo-2006']));
    const p = buildPlan(m, T, ctx);
    const ids = p.items.map((i) => i.id);
    for (const id of ['danger.pregnancy', 'danger.child', 'imm.child_next', 'bf.while_pregnant', 'nutr.sibling_feeding', 'nutr.back_to_back', 'risk.short_birth_interval']) expect(ids, id).toContain(id);
    expect(p.items.find((i) => i.id === 'bf.while_pregnant')!.sources.map((x) => x.id)).toContain('lopez-fernandez-2017');
    expect(p.summary).toMatch(/also caring for Ebube/);
  });

  it('a 3-month-old and a 15-month-old: one plan, items and alerts tagged per child', () => {
    const older = kid('c1', 'Aliyu Musa', '2025-08-06', { feeding: 'complementary_no_breastmilk' });
    const baby = kid('c2', 'Zainab Musa', '2026-08-06');
    const m = makeMother({
      children: [older, baby],
      events: [
        birth(older),
        birth(baby),
        ev<SymptomEvent>({ kind: 'symptom', at: `${T}T08:00:00Z`, symptoms: ['baby_fever'], via: 'visit', childId: 'c1' }),
      ],
    });
    const s = deriveState(m, T);
    expect(s.stage).toBe('infant');
    expect(s.infant?.id).toBe('c2');
    expect(s.children?.map((c) => c.name)).toEqual(['Aliyu Musa', 'Zainab Musa']);
    expect(s.children?.[0].immunisation.overdue.length).toBeGreaterThan(0);
    const p = buildPlan(m, T, ctx);
    // Each child has her own vaccine and growth items.
    const vac = p.items.filter((i) => i.id.startsWith('imm.child_next'));
    expect(vac.map((i) => i.childId).sort()).toEqual(['c1', 'c2']);
    expect(p.items.find((i) => i.id === 'baby.growth_monitoring@c1')?.childId).toBe('c1');
    expect(p.items.find((i) => i.id === 'nutr.complementary_feeding@c1')).toBeTruthy();
    expect(p.items.find((i) => i.id === 'bf.exclusive')?.childId).toBe('c2');
    // The older child's fever raises her own alert, tagged by child.
    const fever = p.alerts.find((a) => a.id === 'alert.child_fever@c1')!;
    expect(fever.childId).toBe('c1');
    expect(fever.motherText).toMatch(/Aliyu/);
    expect(p.alerts.some((a) => a.id === 'alert.child_fever')).toBe(false);
    expect(p.items.some((i) => i.id === 'fp.after_close_births')).toBe(true);
  });

  it('twins plus a 22-month-old: every child has danger signs, vaccines and growth checks', () => {
    const neema = kid('c1', 'Neema', '2025-01-05', { feeding: 'complementary_no_breastmilk' });
    const t1 = kid('c2', 'Amani', '2026-09-24', { birthWeightKg: 2.4, gestationAtBirthWeeks: 36 });
    const t2 = kid('c3', 'Baraka', '2026-09-24', { birthWeightKg: 2.3, gestationAtBirthWeeks: 36 });
    const m = makeMother({ children: [neema, t1, t2], events: [birth(neema), birth(t1, 'caesarean'), birth(t2, 'caesarean')] });
    const s = deriveState(m, T);
    expect(s.stage).toBe('postpartum');
    expect(s.children?.filter((c) => c.twin).length).toBe(2);
    const p = buildPlan(m, T, ctx);
    for (const c of ['c1', 'c2', 'c3']) {
      expect(p.items.some((i) => i.childId === c && i.category === 'danger_signs'), c).toBe(true);
      expect(p.items.some((i) => i.childId === c && i.category === 'immunisation'), c).toBe(true);
      expect(p.items.some((i) => i.childId === c && i.id.startsWith('baby.growth_monitoring')), c).toBe(true);
    }
    // Low birth weight risk for both twins.
    expect(s.risks.filter((r) => r.code.startsWith('low_birth_weight')).length).toBe(2);
    expect(p.summary).toMatch(/twins/);
  });

  it('one visit checklist covers every child, with sections per child, and events keep the child id', () => {
    const older = kid('c1', 'Aliyu', '2025-08-06', { feeding: 'complementary_no_breastmilk' });
    const baby = kid('c2', 'Zainab', '2026-08-06');
    const m = makeMother({ children: [older, baby], events: [birth(older), birth(baby)] });
    const cl = buildVisitChecklist(m, T);
    expect(cl.children.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    expect(cl.children.find((c) => c.id === 'c1')?.templateId).toBe('child_15m');
    expect(cl.bySubject?.map((g) => g.title)).toEqual(['Mother', 'Zainab', 'Aliyu']);
    const w1 = cl.items.find((i) => i.baseId === 'b.weight' && i.childId === 'c1')!;
    const w2 = cl.items.find((i) => i.baseId === 'b.weight' && i.childId === 'c2')!;
    expect(w1 && w2).toBeTruthy();
    const events = checklistToEvents(cl, { [w1.id]: { itemId: w1.id, status: 'value', value: 10.2 }, [w2.id]: { itemId: w2.id, status: 'value', value: 5.6 } }, 'w1', T);
    const growth = events.filter((e) => e.kind === 'growth');
    expect(growth.map((g) => g.childId).sort()).toEqual(['c1', 'c2']);
    // A childId option still narrows to that child.
    expect(buildVisitChecklist(m, T, { childId: 'c1' }).children.map((c) => c.id)).toEqual(['c1']);
  });

  it('older children keep vaccine schedules: an overdue sibling adds to the contact priority', () => {
    const older = kid('c1', 'Aliyu', '2025-08-06');
    const baby = kid('c2', 'Zainab', '2026-08-06');
    const imm = ev<ImmunisationEvent>({ kind: 'immunisation', at: '2026-08-07T10:00:00Z', childId: 'c2', vaccines: ['BCG', 'OPV0', 'HepB0'] });
    const m = makeMother({ children: [older, baby], events: [birth(older), birth(baby), imm] });
    const s = deriveState(m, T);
    expect(s.contactPriority?.reasons.join(' ')).toMatch(/Aliyu/);
  });

  it('seed has the three multi-child mothers with consistent histories', () => {
    const seed = createSeedState();
    const ngozi = seed.mothers.find((x) => x.id === 'm-ng-ngozic')!;
    const sN = deriveState(ngozi, seed.clock);
    expect(sN.stage).toBe('pregnancy');
    expect(sN.gestationalWeeks).toBe(20);
    expect(sN.children?.[0].ageDays).toBeGreaterThanOrEqual(300);
    expect(sN.risks.some((r) => r.code === 'short_birth_interval')).toBe(true);
    const halima = seed.mothers.find((x) => x.id === 'm-ng-halimam')!;
    const sH = deriveState(halima, seed.clock);
    expect(sH.children?.map((c) => Math.round(c.ageDays / 30.4))).toEqual([15, 3]);
    const w = seed.mothers.find((x) => x.id === 'm-ke-wanjiku')!;
    const sW = deriveState(w, seed.clock);
    expect(sW.children?.length).toBe(3);
    expect(sW.children?.filter((c) => c.twin).length).toBe(2);
    expect(Math.round(sW.children![0].ageDays / 30.4)).toBe(22);
    // Births recorded once per baby; one PNC visit a day for the twins.
    expect(w.events.filter((e) => e.kind === 'birth').length).toBe(2);
  });
});

describe('constraints and unknown results', () => {
  const preg = (events: ConstraintEvent[] | Array<ConstraintEvent | VitalsEvent | SymptomEvent>) => makeMother({ incomeBand: 'low', pregnancy: { lmp: '2026-05-14', fetuses: 1 }, events: events as never });

  it('cannot afford iron: free source, food plan alongside (never instead), earlier Hb', () => {
    const m = preg([ev<ConstraintEvent>({ kind: 'constraint', at: `${T}T09:00:00Z`, itemId: 'med.iron_folate', reason: 'cannot_afford' })]);
    const p = buildPlan(m, T, { ...ctx, location: { country: 'NG', region: 'Enugu', localFoods: [{ name: 'Eggs from her own hens', nutrients: ['iron', 'protein'] }, { name: 'Ugu (fluted pumpkin leaves)', nutrients: ['iron'] }] } });
    const iron = p.items.find((i) => i.id === 'med.iron_folate')!;
    expect(iron.status).toBe('active');
    expect(iron.constraint?.reason).toBe('cannot_afford');
    expect(iron.alternatives?.map((a) => a.reason)).toEqual(['cannot_afford', 'cannot_afford', 'cannot_afford']);
    const food = p.items.find((i) => i.id === 'alt.med.iron_folate.food')!;
    expect(food.detail).toMatch(/cannot replace iron/);
    expect(food.motherText).toMatch(/cannot replace the tablet/);
    expect(food.detail).toMatch(/one egg/i);
    expect(p.items.find((i) => i.id === 'alt.med.iron_folate.free')!.detail).toMatch(/PHC/);
    expect(p.items.find((i) => i.id === 'test.hb_recheck_early')!.dueDate).toBe('2026-12-03');
  });

  it('side effects: mild gives tips and keeps the tablet; severe allergy raises an urgent stop-and-refer alert', () => {
    const mild = buildPlan(preg([ev<ConstraintEvent>({ kind: 'constraint', at: `${T}T09:00:00Z`, itemId: 'med.iron_folate', reason: 'side_effects', sideEffect: { symptoms: ['nausea', 'black_stools'], severity: 'mild' } })]), T, ctx);
    const tip = mild.items.find((i) => i.id === 'alt.med.iron_folate.side_effects')!;
    expect(tip.detail).toMatch(/night or with food/);
    expect(tip.detail).toMatch(/harmless/);
    expect(mild.alerts.some((a) => a.id.startsWith('alert.side_effect'))).toBe(false);
    const severe = buildPlan(preg([ev<ConstraintEvent>({ kind: 'constraint', at: `${T}T09:00:00Z`, itemId: 'med.iptp', reason: 'side_effects', sideEffect: { symptoms: ['yellow_eyes'], severity: 'moderate' } })]), T, ctx);
    const a = severe.alerts.find((x) => x.id === 'alert.side_effect.med.iptp')!;
    expect(a.level).toBe('urgent');
    expect(a.action).toMatch(/NAFDAC/);
    const vac = makeMother({ children: [kid('c1', 'Ada', '2026-09-20')], events: [ev<ConstraintEvent>({ kind: 'constraint', at: `${T}T09:00:00Z`, itemId: 'imm.PENTA1', childId: 'c1', reason: 'side_effects', sideEffect: { symptoms: ['convulsion'], severity: 'severe' } })] });
    const va = buildPlan(vac, T, ctx).alerts.find((x) => x.id.startsWith('alert.side_effect'))!;
    expect(va.level).toBe('emergency');
    expect(va.childId).toBe('c1');
  });

  it('declined: her decision recorded, the concern answered, danger education kept for safety-critical items', () => {
    const p = buildPlan(preg([ev<ConstraintEvent>({ kind: 'constraint', at: `${T}T09:00:00Z`, itemId: 'med.iron_folate', reason: 'declined', declinedReason: 'fear_of_side_effects' })]), T, ctx);
    const d = p.items.find((i) => i.id === 'alt.med.iron_folate.declined')!;
    expect(d.detail).toMatch(/respected/);
    expect(d.motherTextKey).toBe('declined.fear_of_side_effects');
    expect(d.howTo?.steps.length).toBeGreaterThan(0);
    expect(p.items.some((i) => i.id === 'alt.med.iron_folate.declined_danger')).toBe(true);
  });

  it('urine protein unknown with BP ≥140/90 escalates to refer for the test today', () => {
    const m = preg([
      ev<VitalsEvent>({ kind: 'vitals', at: `${T}T09:00:00Z`, systolic: 146, diastolic: 94 }),
      ev<ConstraintEvent>({ kind: 'constraint', at: `${T}T09:05:00Z`, itemId: 'test.urine_protein', reason: 'not_available', temporary: true }),
    ]);
    const s = deriveState(m, T);
    expect(s.unknowns?.find((u) => u.test === 'urine_protein')?.action).toBe('refer_for_test');
    const p = buildPlan(m, T, ctx);
    expect(p.alerts.find((a) => a.id === 'alert.untested.urine_protein')?.level).toBe('urgent');
    expect(p.items.find((i) => i.id === 'untested.urine_protein')).toMatchObject({ priority: 1, locked: true });
  });

  it('Hb unknown with pallor, and malaria test unknown with fever, also escalate; an ordinary missing test does not', () => {
    const pale = preg([ev<SymptomEvent>({ kind: 'symptom', at: `${T}T09:00:00Z`, symptoms: ['pallor'], via: 'visit' })]);
    expect(deriveState(pale, T).unknowns?.map((u) => [u.test, u.action])).toContainEqual(['haemoglobin', 'refer_for_test']);
    const hot = preg([ev<VitalsEvent>({ kind: 'vitals', at: `${T}T09:00:00Z`, temperatureC: 38.6 })]);
    expect(deriveState(hot, T).unknowns?.map((u) => u.test)).toContain('malaria_rdt');
    const declined = preg([ev<ConstraintEvent>({ kind: 'constraint', at: `${T}T09:00:00Z`, itemId: 'test.hiv', reason: 'declined', declinedReason: 'does_not_see_need' })]);
    const u = deriveState(declined, T).unknowns!;
    expect(u).toEqual([expect.objectContaining({ test: 'hiv', action: 'test_next_visit' })]);
    expect(buildPlan(declined, T, ctx).alerts.some((a) => a.id.startsWith('alert.untested'))).toBe(false);
  });

  it('a later result clears the unknown', () => {
    const m = preg([
      ev<ConstraintEvent>({ kind: 'constraint', at: '2026-11-01T09:00:00Z', itemId: 'test.hiv', reason: 'not_available' }),
      ev({ kind: 'lab', at: '2026-11-04T09:00:00Z', test: 'hiv', value: 'negative' } as never),
    ]);
    expect(deriveState(m, T).unknowns).toBeUndefined();
  });
});

describe('how-to on every recommendation', () => {
  it('every active plan item in the seed has steps, with translation keys', () => {
    const seed = createSeedState();
    const missing: string[] = [];
    for (const m of seed.mothers) {
      for (const i of buildPlan(m, seed.clock, { overrides: seed.overrides, learnedRules: seed.learnedRules }).items) {
        if (i.status !== 'active' || i.origin === 'worker_added' || i.origin === 'learned_rule') continue;
        if (!i.howTo?.steps.length || i.howTo.stepKeys?.length !== i.howTo.steps.length) missing.push(i.id);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('exercise advice lists concrete exercises and what to avoid, with a guide', () => {
    const p = buildPlan(makeMother({ pregnancy: { lmp: '2026-05-14', fetuses: 1 } }), T, ctx);
    const h = p.items.find((i) => i.id === 'activity.pregnancy')!.howTo!;
    expect(h.steps.join(' ')).toMatch(/hands and knees/);
    expect(h.steps.join(' ')).toMatch(/20 to 30 minutes/);
    expect(h.avoid?.length).toBeGreaterThan(0);
    expect(h.guideId).toBe('back_pain_exercises');
  });
});

describe('personal mode', () => {
  it('only mother text, alerts become go-now actions with the emergency number, register and book items stay until done', () => {
    const m = makeMother({ pregnancy: { lmp: '2026-05-14', fetuses: 1 }, events: [ev<SymptomEvent>({ kind: 'symptom', at: `${T}T09:00:00Z`, symptoms: ['vaginal_bleeding'], severity: 'severe', via: 'sms' })] });
    const p = buildPlan(m, T, { ...ctx, mode: 'personal', nearestFacility: 'Abakpa Nike PHC' });
    // Emergency referral first, then her two self-care steps, ahead of everything else.
    expect(p.items[0].id).toBe('refer.vaginal_bleeding');
    expect(p.items.slice(1, 3).every((i) => i.id.startsWith('personal.') || i.id.startsWith('danger.'))).toBe(true);
    expect(p.items.map((i) => i.id)).toEqual(expect.arrayContaining(['personal.register', 'personal.book']));
    expect(p.items.some((i) => i.audience === 'worker' || i.id === 'mh.epds_screen')).toBe(false);
    for (const i of p.items) expect(i.detail).toBe(i.motherText);
    const a = p.alerts.find((x) => x.level === 'emergency')!;
    expect(a.action).toBe('Go to Abakpa Nike PHC now. If you cannot get there, call 112.');
    const done = buildPlan({ ...m, selfCare: { registeredWithClinicAt: '2026-10-01', nextCheckupAt: '2026-11-20' } }, T, { ...ctx, mode: 'personal' });
    expect(done.items.some((i) => i.id.startsWith('personal.'))).toBe(false);
  });

  it('worker mode is unchanged by default', () => {
    const m = makeMother({ pregnancy: { lmp: '2026-05-14', fetuses: 1 } });
    expect(buildPlan(m, T, ctx).items.some((i) => i.id.startsWith('personal.'))).toBe(false);
  });
});

export type { FeedingEvent };
