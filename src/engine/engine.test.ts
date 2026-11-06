import { describe, expect, it } from 'vitest';
import type { BirthEvent, Child, FeedingEvent, LabEvent, Override, ScreeningEvent, SymptomEvent, VisitEvent, VitalsEvent } from '../types';
import { approveProposal, buildPlan, deriveState, eddFromLmp, gestationalWeeks, ruleMatches, upsertProposal } from './index';
import { ev, makeMother } from './fixtures.test-helpers';

const TODAY = '2026-11-05';
const ctx = { overrides: [], learnedRules: [] };
// LMP giving exactly 28 weeks on TODAY
const LMP_28 = '2026-04-23';

const baby = (dob: string, over: Partial<Child> = {}): Child => ({
  id: 'c1',
  name: 'Chidi',
  sex: 'M',
  dob,
  birthWeightKg: 3.1,
  gestationAtBirthWeeks: 39,
  feeding: 'exclusive_breastfeeding',
  ...over,
});

describe('dates', () => {
  it('computes gestational age in completed weeks', () => {
    expect(gestationalWeeks(LMP_28, TODAY)).toBe(28);
    expect(gestationalWeeks('2026-10-01', '2026-10-10')).toBe(1);
    expect(gestationalWeeks('2026-10-01', '2026-10-07')).toBe(0);
  });
  it('computes EDD as LMP + 280 days', () => {
    expect(eddFromLmp('2026-01-01')).toBe('2026-10-08');
    expect(eddFromLmp(LMP_28)).toBe('2027-01-28');
  });
});

describe('stage detection', () => {
  it('pregnancy when pregnant with no later birth', () => {
    const s = deriveState(makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY);
    expect(s.stage).toBe('pregnancy');
    expect(s.gestationalWeeks).toBe(28);
    expect(s.trimester).toBe(3);
    expect(s.edd).toBe('2027-01-28');
  });

  it('postpartum for 0–42 days after a birth event, even if the pregnancy record remains', () => {
    const child = baby('2026-10-30');
    const m = makeMother({
      pregnancy: { lmp: '2026-01-20', fetuses: 1 },
      events: [ev<BirthEvent>({ kind: 'birth', at: '2026-10-30T08:00:00Z', birth: { date: '2026-10-30', mode: 'vaginal', place: 'facility', complications: ['none'] }, child })],
    });
    const s = deriveState(m, TODAY);
    expect(s.stage).toBe('postpartum');
    expect(s.daysPostpartum).toBe(6);
    expect(s.infant?.id).toBe('c1');
  });

  it('infant stage from 43 days to 1,000 days of the youngest child', () => {
    const m = makeMother({ children: [baby('2026-06-01')], birth: { date: '2026-06-01', mode: 'vaginal', place: 'facility', complications: ['none'] } });
    const s = deriveState(m, TODAY);
    expect(s.stage).toBe('infant');
    expect(s.infantAgeDays).toBe(157);
  });

  it('preconception otherwise, including when the youngest child is over 1,000 days', () => {
    expect(deriveState(makeMother(), TODAY).stage).toBe('preconception');
    expect(deriveState(makeMother({ children: [baby('2023-01-01')] }), TODAY).stage).toBe('preconception');
  });

  it('only counts events up to asOf', () => {
    const m = makeMother({
      pregnancy: { lmp: LMP_28, fetuses: 1 },
      events: [ev<VitalsEvent>({ kind: 'vitals', at: '2026-11-10T09:00:00Z', systolic: 170, diastolic: 115 })],
    });
    expect(buildPlan(m, TODAY, ctx).alerts).toHaveLength(0);
  });
});

describe('danger-sign alerts', () => {
  it('severe-range BP with headache gives an emergency severe pre-eclampsia alert and locked referral', () => {
    const m = makeMother({
      pregnancy: { lmp: LMP_28, fetuses: 1 },
      events: [
        ev<VitalsEvent>({ kind: 'vitals', at: `${TODAY}T09:00:00Z`, systolic: 166, diastolic: 112 }),
        ev<SymptomEvent>({ kind: 'symptom', at: `${TODAY}T09:00:00Z`, symptoms: ['severe_headache'], via: 'visit' }),
      ],
    });
    const plan = buildPlan(m, TODAY, ctx);
    const a = plan.alerts.find((x) => x.id === 'alert.severe_pre_eclampsia');
    expect(a?.level).toBe('emergency');
    expect(a?.action).toMatch(/General Hospital/);
    expect(a?.action).toMatch(/Do not give diazepam/);
    expect(a?.sources.length).toBeGreaterThan(0);
    const refer = plan.items.find((i) => i.id === 'refer.severe_pre_eclampsia');
    expect(refer?.locked).toBe(true);
    expect(plan.summary).toMatch(/28 weeks, second pregnancy/);
    expect(plan.summary).toMatch(/166\/112/);
  });

  it('summary is plain sentences with the next contact said once', () => {
    const plan = buildPlan(makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 }, events: [ev<VitalsEvent>({ kind: 'vitals', at: `${TODAY}T09:00:00Z`, systolic: 110, diastolic: 70 })] }), TODAY, ctx);
    expect(plan.summary.match(/Next/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(plan.summary).not.toMatch(/;|Next:/);
    if (plan.nextContact) expect(plan.summary).toMatch(/Next contact [^.]+: [^.]+\.$/);
  });

  it('BP 148/96 alone is urgent hypertension, not pre-eclampsia', () => {
    const m = makeMother({
      pregnancy: { lmp: LMP_28, fetuses: 1 },
      events: [ev<VitalsEvent>({ kind: 'vitals', at: `${TODAY}T09:00:00Z`, systolic: 148, diastolic: 96 })],
    });
    const ids = buildPlan(m, TODAY, ctx).alerts.map((a) => [a.id, a.level]);
    expect(ids).toContainEqual(['alert.hypertension', 'urgent']);
    expect(ids.map((x) => x[0])).not.toContain('alert.severe_pre_eclampsia');
  });

  it('BP ≥140/90 with 2+ proteinuria is pre-eclampsia (urgent)', () => {
    const m = makeMother({
      pregnancy: { lmp: LMP_28, fetuses: 1 },
      events: [
        ev<VitalsEvent>({ kind: 'vitals', at: `${TODAY}T09:00:00Z`, systolic: 144, diastolic: 94 }),
        ev<LabEvent>({ kind: 'lab', at: `${TODAY}T09:10:00Z`, test: 'urine_protein', value: 2 }),
      ],
    });
    const a = buildPlan(m, TODAY, ctx).alerts.find((x) => x.id === 'alert.severe_pre_eclampsia');
    expect(a?.level).toBe('urgent');
  });

  it('EPDS 15 creates an urgent mental-health referral alert', () => {
    const m = makeMother({
      children: [baby('2026-09-20')],
      birth: { date: '2026-09-20', mode: 'vaginal', place: 'facility', complications: ['none'] },
      events: [ev<ScreeningEvent>({ kind: 'screening', at: `${TODAY}T10:00:00Z`, instrument: 'epds', score: 15 })],
    });
    const plan = buildPlan(m, TODAY, ctx);
    const a = plan.alerts.find((x) => x.id === 'alert.depression');
    expect(a?.level).toBe('urgent');
    expect(plan.items.find((i) => i.id === 'mh.thinking_healthy')).toBeTruthy();
  });

  it('EPDS self-harm item is a same-day emergency regardless of score', () => {
    const m = makeMother({
      children: [baby('2026-09-20')],
      events: [ev<ScreeningEvent>({ kind: 'screening', at: `${TODAY}T10:00:00Z`, instrument: 'epds', score: 6, selfHarmFlag: true })],
    });
    expect(buildPlan(m, TODAY, ctx).alerts[0].id).toBe('alert.self_harm');
    expect(buildPlan(m, TODAY, ctx).alerts[0].level).toBe('emergency');
  });

  it('Nigerian EPDS cut-offs: 10 is a positive screen (warning), 12 refers', () => {
    const mk = (score: number, country: 'NG' | 'KE' = 'NG') =>
      buildPlan(
        makeMother({ country, region: country === 'KE' ? 'Nairobi' : 'Enugu', children: [baby('2026-09-20')], events: [ev<ScreeningEvent>({ kind: 'screening', at: `${TODAY}T10:00:00Z`, instrument: 'epds', score })] }),
        TODAY,
        ctx,
      ).alerts.map((a) => a.id);
    expect(mk(10)).toContain('alert.low_mood_screen');
    expect(mk(12)).toContain('alert.depression');
    expect(mk(12, 'KE')).toContain('alert.low_mood_screen');
  });

  it('newborn fast breathing is an emergency', () => {
    const child = baby('2026-11-01');
    const m = makeMother({
      events: [
        ev<BirthEvent>({ kind: 'birth', at: '2026-11-01T06:00:00Z', birth: { date: '2026-11-01', mode: 'vaginal', place: 'home', complications: ['none'] }, child }),
        ev<SymptomEvent>({ kind: 'symptom', at: `${TODAY}T07:00:00Z`, symptoms: ['baby_fast_breathing'], via: 'sms', childId: 'c1', recordedBy: 'mother' }),
      ],
    });
    const plan = buildPlan(m, TODAY, ctx);
    const a = plan.alerts.find((x) => x.id === 'alert.newborn_danger');
    expect(a?.level).toBe('emergency');
    expect(a?.subject).toBe('child');
    expect(plan.state.contactPriority!.score).toBeGreaterThanOrEqual(100);
    expect(plan.state.contactPriority!.reasons.join(' ')).toMatch(/fast breathing/);
  });

  it('Hb below 7 is urgent severe anaemia; 7–9.9 is moderate', () => {
    const mk = (hb: number) =>
      buildPlan(makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 }, events: [ev<LabEvent>({ kind: 'lab', at: `${TODAY}T09:00:00Z`, test: 'haemoglobin', value: hb })] }), TODAY, ctx).alerts;
    expect(mk(6.5).find((a) => a.id === 'alert.severe_anaemia')?.level).toBe('urgent');
    expect(mk(8.8).find((a) => a.id === 'alert.moderate_anaemia')?.level).toBe('warning');
  });

  it('reduced fetal movement only alerts after 28 weeks', () => {
    const mk = (lmp: string) =>
      buildPlan(makeMother({ pregnancy: { lmp, fetuses: 1 }, events: [ev<SymptomEvent>({ kind: 'symptom', at: `${TODAY}T09:00:00Z`, symptoms: ['reduced_fetal_movement'], via: 'sms' })] }), TODAY, ctx).alerts.map((a) => a.id);
    expect(mk(LMP_28)).toContain('alert.reduced_fetal_movement');
    expect(mk('2026-07-01')).not.toContain('alert.reduced_fetal_movement');
  });
});

describe('personalisation', () => {
  it('sickle cell disease swaps routine iron for folic acid (NG: 5 mg with advisory-board flag)', () => {
    const base = buildPlan(makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx);
    expect(base.items.some((i) => i.id === 'med.iron_folate')).toBe(true);

    const scd = buildPlan(makeMother({ genotype: 'SS', conditions: ['sickle_cell_disease'], pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx);
    expect(scd.items.some((i) => i.id === 'med.iron_folate')).toBe(false);
    const fa = scd.items.find((i) => i.id === 'med.folic_acid_high_dose')!;
    expect(fa.title).toMatch(/5 mg/);
    expect(fa.detail).toMatch(/400 µg/); // WHO 2025 conflict stated
    expect(fa.because).toContain('Dose to be confirmed by clinical advisory board (WHO 2025 vs national practice)');
    expect(scd.alerts.some((a) => a.id === 'alert.scd_pathway')).toBe(true);
    expect(scd.items.find((i) => i.id === 'visit.scd_specialist')?.locked).toBe(true);
  });

  it('SCD in Ghana follows WHO 2025: 400 µg with IPTp-SP', () => {
    const p = buildPlan(makeMother({ country: 'GH', region: 'Northern', genotype: 'SS', conditions: ['sickle_cell_disease'], pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx);
    expect(p.items.find((i) => i.id === 'med.folic_acid_scd')?.title).toMatch(/400 µg/);
  });

  it('very low income gets the cheapest foods and free programmes', () => {
    const rich = buildPlan(makeMother({ incomeBand: 'high', pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx).items.find((i) => i.id === 'nutr.iron_foods')!;
    const poor = buildPlan(makeMother({ incomeBand: 'very_low', pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx).items.find((i) => i.id === 'nutr.iron_foods')!;
    expect(poor.detail).not.toEqual(rich.detail);
    expect(poor.detail).toMatch(/Beans/);
    expect(poor.detail).not.toMatch(/Liver|Meat/);
    expect(poor.detail).toMatch(/free/i);
    expect(rich.detail).toMatch(/Liver|Meat/);
  });

  it('low literacy shortens mother text', () => {
    const good = buildPlan(makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx).items.find((i) => i.id === 'danger.pregnancy')!;
    const low = buildPlan(makeMother({ literacy: 'none', pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx).items.find((i) => i.id === 'danger.pregnancy')!;
    expect(low.motherText.length).toBeLessThan(good.motherText.length);
  });

  it('aspirin is added and locked for high pre-eclampsia risk', () => {
    const p = buildPlan(makeMother({ conditions: ['pre_eclampsia_history'], pregnancy: { lmp: '2026-08-01', fetuses: 1 } }), TODAY, ctx);
    const a = p.items.find((i) => i.id === 'med.aspirin');
    expect(a?.locked).toBe(true);
    expect(a?.detail).toMatch(/75 mg/);
  });

  it('Kenya outside endemic counties gets no IPTp item but an explanation on the net', () => {
    const p = buildPlan(makeMother({ country: 'KE', region: 'Nairobi', pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx);
    expect(p.items.some((i) => i.id === 'med.iptp')).toBe(false);
    expect(p.items.find((i) => i.id === 'rest.itn')?.detail).toMatch(/endemic/);
    const kisumu = buildPlan(makeMother({ country: 'KE', region: 'Kisumu', pregnancy: { lmp: LMP_28, fetuses: 1 } }), TODAY, ctx);
    expect(kisumu.items.find((i) => i.id === 'med.iptp')?.locked).toBe(true);
  });

  it('cord care is chlorhexidine in Nigeria and dry in Ghana', () => {
    const mk = (country: 'NG' | 'GH') =>
      buildPlan(makeMother({ country, children: [baby('2026-11-02')], birth: { date: '2026-11-02', mode: 'vaginal', place: 'facility', complications: ['none'] } }), TODAY, ctx).items.find((i) => i.id === 'baby.cord_care')!;
    expect(mk('NG').title).toMatch(/chlorhexidine/);
    expect(mk('GH').title).toMatch(/clean and dry/);
  });

  it('low milk supply adds the evidence-graded plan', () => {
    const m = makeMother({
      children: [baby('2026-10-20')],
      birth: { date: '2026-10-20', mode: 'vaginal', place: 'facility', complications: ['none'] },
      events: [ev<FeedingEvent>({ kind: 'feeding', at: `${TODAY}T09:00:00Z`, status: 'exclusive_breastfeeding', milkSupply: 'low', feedsPerDay: 5, childId: 'c1' })],
    });
    const item = buildPlan(m, TODAY, ctx).items.find((i) => i.id === 'bf.low_milk_plan');
    expect(item?.detail).toMatch(/moringa/i);
  });

  it('PNC contacts get clear due dates and overdue contacts are flagged', () => {
    const child = baby('2026-11-01');
    const m = makeMother({
      events: [
        ev<BirthEvent>({ kind: 'birth', at: '2026-11-01T06:00:00Z', birth: { date: '2026-11-01', mode: 'vaginal', place: 'home', complications: ['none'] }, child }),
        ev<VisitEvent>({ kind: 'visit', at: '2026-11-01T15:00:00Z', visitType: 'home_visit', attended: true }),
      ],
    });
    const p = buildPlan(m, TODAY, ctx);
    expect(p.items.find((i) => i.id === 'visit.pnc_24h')?.status).toBe('done');
    const d3 = p.items.find((i) => i.id === 'visit.pnc_day3')!;
    expect(d3.status).toBe('active');
    expect(d3.dueDate).toBe(TODAY);
    expect(d3.detail).toMatch(/Overdue/);
    expect(p.items.find((i) => i.id === 'visit.pnc_day7_14')?.dueDate).toBe('2026-11-08');
  });

  it('next newborn vaccines come from the national schedule', () => {
    const p = buildPlan(makeMother({ children: [baby('2026-09-20')] }), TODAY, ctx);
    const imm = p.items.find((i) => i.id === 'imm.child_next')!;
    expect(imm.detail).toMatch(/BCG/);
  });
});

describe('overrides and learned rules', () => {
  const preg = () => makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 } });
  const ov = (o: Partial<Override>): Override => ({
    id: 'o1',
    motherId: 'm1',
    itemId: 'danger.pregnancy',
    action: 'remove',
    reason: 'test',
    workerId: 'w1',
    createdAt: TODAY,
    proposeGlobal: false,
    status: 'active',
    ...o,
  });

  it('a locked item cannot be removed by an override', () => {
    const p = buildPlan(preg(), TODAY, { overrides: [ov({})], learnedRules: [] });
    const item = p.items.find((i) => i.id === 'danger.pregnancy')!;
    expect(item.status).toBe('active');
    expect(item.overriddenBy).toBeUndefined();
  });

  it('security: a locked item cannot be rewritten or hidden by a modify override (SEC-02)', () => {
    const before = buildPlan(preg(), TODAY, { overrides: [], learnedRules: [] }).items.find((i) => i.id === 'danger.pregnancy')!;
    const p = buildPlan(preg(), TODAY, {
      overrides: [ov({ action: 'modify', item: { title: 'Nothing to worry about', motherText: 'It is normal. Stay at home.', status: 'removed', priority: 5 } as Override['item'] })],
      learnedRules: [],
    });
    const item = p.items.find((i) => i.id === 'danger.pregnancy')!;
    expect(item.status).toBe('active');
    expect(item.title).toBe(before.title);
    expect(item.motherText).toBe(before.motherText);
    expect(item.priority).toBe(before.priority);
    expect(item.overriddenBy).toBeUndefined();
  });

  it('security: a modify override never removes an unlocked item either (removal is its own action)', () => {
    const p = buildPlan(preg(), TODAY, {
      overrides: [ov({ itemId: 'activity.pregnancy', action: 'modify', item: { title: 'Gentle walks', status: 'removed' } as Override['item'] })],
      learnedRules: [],
    });
    const it2 = p.items.find((i) => i.id === 'activity.pregnancy')!;
    expect(it2.title).toBe('Gentle walks');
    expect(it2.status).toBe('active');
  });

  it('an unlocked item can be removed', () => {
    const p = buildPlan(preg(), TODAY, { overrides: [ov({ itemId: 'activity.pregnancy' })], learnedRules: [] });
    expect(p.items.find((i) => i.id === 'activity.pregnancy')?.status).toBe('removed');
  });

  it('a modify override replaces fields and keeps origin', () => {
    const p = buildPlan(preg(), TODAY, {
      overrides: [ov({ id: 'o2', itemId: 'nutr.iron_foods', action: 'modify', item: { title: 'Beans and ugu daily (she dislikes eggs)', motherText: 'Eat beans and ugu every day.' } })],
      learnedRules: [],
    });
    const it2 = p.items.find((i) => i.id === 'nutr.iron_foods')!;
    expect(it2.title).toBe('Beans and ugu daily (she dislikes eggs)');
    expect(it2.motherText).toBe('Eat beans and ugu every day.');
    expect(it2.origin).toBe('guideline');
    expect(it2.overriddenBy).toBe('o2');
  });

  it('an add override creates a worker_added item graded C', () => {
    const p = buildPlan(preg(), TODAY, { overrides: [ov({ id: 'o3', itemId: 'custom.transport', action: 'add', item: { title: 'Save ₦3,000 for keke to the hospital', category: 'birth_preparedness' } })], learnedRules: [] });
    const it3 = p.items.find((i) => i.id === 'custom.transport')!;
    expect(it3.origin).toBe('worker_added');
    expect(it3.evidence).toBe('C');
  });

  it('reverted overrides are ignored', () => {
    const p = buildPlan(preg(), TODAY, { overrides: [ov({ itemId: 'activity.pregnancy', status: 'reverted' })], learnedRules: [] });
    expect(p.items.find((i) => i.id === 'activity.pregnancy')?.status).toBe('active');
  });

  it('a learned rule applies to a matching mother but not a non-matching one', () => {
    const scdMother = makeMother({ genotype: 'SS', conditions: ['sickle_cell_disease'], pregnancy: { lmp: LMP_28, fetuses: 1 } });
    const otherMother = makeMother({ id: 'm2', pregnancy: { lmp: LMP_28, fetuses: 1 } });
    const state = deriveState(scdMother, TODAY);
    let proposals = upsertProposal(
      ov({ id: 'o4', itemId: 'scd.hydration', action: 'add', proposeGlobal: true, item: { title: 'Drink 3 litres of water daily to prevent crises', category: 'nutrition' }, reason: 'Hydration prevents crises' }),
      scdMother,
      state,
      [],
      TODAY,
    );
    // A second worker with a similar patient supports the same proposal.
    proposals = upsertProposal(
      ov({ id: 'o5', workerId: 'w2', itemId: 'scd.hydration', action: 'add', proposeGlobal: true, item: { title: 'Drink 3 litres of water daily to prevent crises', category: 'nutrition' }, reason: 'Same' }),
      scdMother,
      state,
      proposals,
      TODAY,
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0].supportingWorkerIds).toEqual(['w1', 'w2']);
    expect(proposals[0].status).toBe('pending');
    expect(proposals[0].appliesWhen.stage).toBe('pregnancy');

    const { proposal, rule } = approveProposal(proposals[0], 'doc1', 'Agreed', TODAY);
    expect(proposal.status).toBe('approved');
    expect(ruleMatches(rule.appliesWhen, scdMother, state)).toBe(true);
    expect(ruleMatches(rule.appliesWhen, otherMother, deriveState(otherMother, TODAY))).toBe(false);

    const withRule = buildPlan(scdMother, TODAY, { overrides: [], learnedRules: [rule] }).items.find((i) => i.id === 'scd.hydration');
    expect(withRule?.origin).toBe('learned_rule');
    expect(withRule?.evidence).toBe('expert');
    expect(buildPlan(otherMother, TODAY, { overrides: [], learnedRules: [rule] }).items.some((i) => i.id === 'scd.hydration')).toBe(false);
  });

  it('alerts cannot be suppressed by overrides or learned rules', () => {
    const m = makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 }, events: [ev<SymptomEvent>({ kind: 'symptom', at: `${TODAY}T09:00:00Z`, symptoms: ['vaginal_bleeding'], via: 'sms' })] });
    const p = buildPlan(m, TODAY, {
      overrides: [ov({ itemId: 'refer.vaginal_bleeding' })],
      learnedRules: [{ id: 'r1', proposalId: 'p', appliesWhen: {}, effect: 'remove', itemId: 'refer.vaginal_bleeding', approvedBy: 'x', approvedAt: TODAY }],
    });
    expect(p.alerts.map((a) => a.id)).toContain('alert.vaginal_bleeding');
    expect(p.items.find((i) => i.id === 'refer.vaginal_bleeding')?.status).toBe('active');
  });
});

describe('plan diff and versioning', () => {
  it('detects added items and new alerts and bumps the version', () => {
    const m = makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 } });
    const first = buildPlan(m, TODAY, ctx);
    const prev = { version: 3, itemIds: first.items.filter((i) => i.status !== 'removed').map((i) => i.id), alertIds: first.alerts.map((a) => a.id) };

    const same = buildPlan(m, TODAY, { ...ctx, previous: prev });
    expect(same.version).toBe(3);
    expect(same.changes?.added).toEqual([]);

    const m2 = { ...m, events: [ev<VitalsEvent>({ kind: 'vitals', at: `${TODAY}T11:00:00Z`, systolic: 150, diastolic: 98 })] };
    const next = buildPlan(m2, TODAY, { ...ctx, previous: prev });
    expect(next.version).toBe(4);
    expect(next.changes?.added).toContain('refer.hypertension');
    expect(next.changes?.newAlerts).toContain('alert.hypertension');
  });

  it('is deterministic', () => {
    const m = makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 }, practicesMentioned: ['agbo', 'omugwo'] });
    expect(JSON.stringify(buildPlan(m, TODAY, ctx))).toEqual(JSON.stringify(buildPlan(m, TODAY, ctx)));
  });
});

describe('traditional practices', () => {
  it('a harmful practice yields an unlocked priority-2 reframing item', () => {
    const p = buildPlan(makeMother({ pregnancy: { lmp: LMP_28, fetuses: 1 }, practicesMentioned: ['nzu_clay'] }), TODAY, ctx);
    const item = p.items.find((i) => i.id === 'trad.nzu_clay')!;
    expect(item.category).toBe('traditional_practice');
    expect(item.evidence).toBe('trad_harmful');
    expect(item.priority).toBe(2);
    expect(item.locked).toBeFalsy();
    expect(item.title).toMatch(/^Reframe/);
    expect(item.origin).toBe('traditional');
  });

  it('omugwo after birth adds the carer as part of the care team', () => {
    const p = buildPlan(makeMother({ children: [baby('2026-11-01')], birth: { date: '2026-11-01', mode: 'vaginal', place: 'facility', complications: ['none'] }, practicesMentioned: ['omugwo'] }), TODAY, ctx);
    expect(p.items.find((i) => i.id === 'trad.omugwo')?.evidence).toBe('trad_plausible');
    expect(p.items.find((i) => i.id === 'family.omugwo_carer')).toBeTruthy();
  });
});

describe('location profile', () => {
  const m = () => makeMother({ incomeBand: 'low', pregnancy: { lmp: LMP_28, fetuses: 1 } });
  it('prefers local foods with household quantities and keeps supplements', () => {
    const location = {
      country: 'NG' as const,
      region: 'Kano',
      localFoods: [{ name: 'Baobab leaves (kuka)', nutrients: ['iron', 'calcium'], season: 'all year', costTier: 'cheap' }],
      practices: ['wankan_jego', 'uvulectomy'],
    };
    const p = buildPlan(m(), TODAY, { ...ctx, location });
    const iron = p.items.find((i) => i.id === 'nutr.iron_foods')!;
    expect(iron.detail).toMatch(/foods\): Baobab leaves/);
    expect(iron.detail).toMatch(/never replaces/);
    expect(iron.motherText).toMatch(/two handfuls of cooked baobab leaves/);
    expect(p.items.some((i) => i.id === 'med.iron_folate')).toBe(true);
    // wankan jego is postpartum-only; nothing relevant now for a pregnant woman except none
    expect(p.items.find((i) => i.id === 'trad.ask_local')).toBeUndefined();
  });

  it('surfaces local practices relevant to her stage and can switch IPTp off', () => {
    const p = buildPlan(m(), TODAY, { ...ctx, location: { country: 'NG', region: 'Kano', practices: ['nzu_clay', 'agbo'], malariaEndemic: false } });
    expect(p.items.find((i) => i.id === 'trad.ask_local')?.detail).toMatch(/clay/i);
    expect(p.items.some((i) => i.id === 'med.iptp')).toBe(false);
  });
});

describe('referrals from guided visits', () => {
  it('raises an alert for an open club-foot referral, in the plan itself, until it is closed', () => {
    const child = baby('2026-11-02', { id: 'c1', name: 'Ayo' });
    const birth: BirthEvent = ev({ kind: 'birth', at: '2026-11-02T08:00:00.000Z', birth: { date: '2026-11-02', mode: 'vaginal', place: 'facility', complications: ['none'] }, child });
    const referral = {
      id: 'vc-m1-pnc_48h-2026-11-04-1',
      kind: 'referral' as const,
      at: '2026-11-04T12:00:00.000Z',
      recordedBy: 'w1',
      childId: 'c1',
      toFacilityId: '',
      reason: 'Ayo: Club foot (one foot)',
      urgency: 'routine' as const,
      status: 'open' as const,
      note: 'Refer to a Ponseti clubfoot clinic within 2 weeks.',
    };
    const mother = makeMother({ children: [child], birth: birth.birth, events: [birth, referral] });
    const p = buildPlan(mother, TODAY, ctx);
    const a = p.alerts.find((x) => x.id === `alert.visit_referral.${referral.id}`);
    expect(a).toBeDefined();
    expect(a!.level).toBe('warning');
    expect(a!.subject).toBe('child');
    // Routine finding: the mother line names the place and the timing, never "today" or "now"
    expect(a!.motherTextKey).toBe('vt.refer_within');
    expect(a!.motherText).toMatch(/^Please go to .+ within 2 weeks\. It is not an emergency/);
    expect(a!.motherText).not.toMatch(/today|now/i);
    // Closed referrals stop alerting
    const closed = buildPlan({ ...mother, events: [birth, { ...referral, status: 'arrived' as const }] }, TODAY, ctx);
    expect(closed.alerts.some((x) => x.id.startsWith('alert.visit_referral.'))).toBe(false);
  });
});
