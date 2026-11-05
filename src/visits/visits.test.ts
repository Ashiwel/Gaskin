import { describe, expect, it } from 'vitest';
import type { BirthEvent, Child, ClinicalEvent, FeedingEvent, ImmunisationEvent, LabEvent, Mother, ReferralEvent, SymptomEvent } from '../types';
import { MOTHER_TEXT } from '../clinical';
import { buildPlan, deriveState } from '../engine';
import { ev, makeMother } from '../engine/fixtures.test-helpers';
import { createSeedState } from '../data';
import { buildVisitChecklist, checklistToEvents, dueTemplateId, evaluateFindings, referralAlerts } from './build';
import { CATALOGUE, VISIT_TEMPLATES } from './catalogue';
import { CDC_MILESTONES } from './milestones';
import { VISIT_TEXT, renderVisitText } from './text';
import type { ChecklistItem, ChecklistResult, VisitChecklist } from './types';

const ctx = { overrides: [], learnedRules: [] };

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

function newbornMother(dob: string, over: Partial<Mother> = {}, child: Partial<Child> = {}): Mother {
  const c = baby(dob, child);
  return makeMother({
    pregnancy: { lmp: '2026-01-25', fetuses: 1 },
    events: [ev<BirthEvent>({ kind: 'birth', at: `${dob}T06:00:00Z`, birth: { date: dob, mode: 'vaginal', place: 'facility', complications: ['none'] }, child: c })],
    ...over,
  });
}

function infantMother(dob: string, country: Mother['country'] = 'NG', vaccines: string[] = [], child: Partial<Child> = {}): Mother {
  const c = baby(dob, child);
  return makeMother({
    country,
    children: [c],
    birth: { date: dob, mode: 'vaginal', place: 'facility', complications: ['none'] },
    events: vaccines.length ? [ev<ImmunisationEvent>({ kind: 'immunisation', at: `${dob}T10:00:00Z`, childId: c.id, vaccines })] : [],
  });
}

const base = (cl: VisitChecklist) => new Set(cl.items.map((i) => i.baseId));
const find = (cl: VisitChecklist, baseId: string, childId?: string): ChecklistItem => {
  const it = cl.items.find((i) => i.baseId === baseId && (!childId || i.childId === childId));
  if (!it) throw new Error(`No item ${baseId}`);
  return it;
};

describe('catalogue', () => {
  it('has templates for every contact', () => {
    const ids = VISIT_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      'preconception',
      'anc1', 'anc2', 'anc3', 'anc4', 'anc5', 'anc6', 'anc7', 'anc8',
      'birth', 'pnc_24h', 'pnc_day3', 'pnc_day7_14', 'pnc_6wk',
      'child_10wk', 'child_14wk', 'child_6m', 'child_9m', 'child_12m', 'child_15m', 'child_18m', 'child_24m',
    ]);
    expect(VISIT_TEMPLATES.filter((t) => t.stage === 'pregnancy').map((t) => t.gaWeek)).toEqual([12, 20, 26, 30, 34, 36, 38, 40]);
  });

  it('every catalogue item has a unique stable id and at least one source', () => {
    const ids = CATALOGUE.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATALOGUE) expect(c.sources.length, c.id).toBeGreaterThan(0);
  });

  it('every mother-facing key resolves (VISIT_TEXT or MOTHER_TEXT) and VISIT_TEXT does not clash with MOTHER_TEXT', () => {
    for (const k of Object.keys(VISIT_TEXT)) expect(MOTHER_TEXT[k] === undefined || MOTHER_TEXT[k] === VISIT_TEXT[k], k).toBe(true);
    const seed = createSeedState();
    const asOf = seed.clock;
    for (const m of seed.mothers) {
      for (const t of VISIT_TEMPLATES) {
        if (t.stage === 'pregnancy' && !m.pregnancy) continue;
        const cl = buildVisitChecklist(m, asOf, { visitTemplateId: t.id });
        for (const i of cl.items) {
          if (i.textKey) expect(() => renderVisitText(i.textKey!, i.params), `${t.id} ${i.id}`).not.toThrow();
          for (const sk of i.subKeys ?? []) expect(() => renderVisitText(sk, i.params)).not.toThrow();
          if (i.english) expect(i.english, `${t.id} ${i.id}`).not.toMatch(/\{\w+\}/);
          if (i.input.kind === 'number') expect(i.input.unit.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('covers CDC milestones at 2, 4, 6, 9, 12, 15, 18 and 24 months', () => {
    expect(CDC_MILESTONES.map((s) => s.months)).toEqual([2, 4, 6, 9, 12, 15, 18, 24]);
  });
});

describe('newborn day 1', () => {
  const m = newbornMother('2026-11-04');
  const cl = buildVisitChecklist(m, '2026-11-05');

  it('picks the 24-hour postnatal visit', () => {
    expect(cl.templateId).toBe('pnc_24h');
    expect(cl.children[0].name).toBe('Chidi');
  });

  it('includes club foot, cleft palate, jaundice, cord, spine and hips checks', () => {
    const b = base(cl);
    for (const id of ['b.talipes', 'b.cleft', 'b.jaundice', 'b.cord', 'b.spine', 'b.hips', 'b.limbs', 'b.anus', 'b.genitalia', 'b.temp', 'b.breathing', 'b.latch']) expect(b.has(id), id).toBe(true);
    const cleft = find(cl, 'b.cleft');
    expect(cleft.input.kind === 'choice' && cleft.input.options.some((o) => o.value === 'palate')).toBe(true);
    const jaundice = find(cl, 'b.jaundice');
    expect(jaundice.sources.some((s) => s.id === 'kramer-1969')).toBe(true);
  });

  it('checks the mother: BP, womb, bleeding and bladder; and gives birth doses due', () => {
    const b = base(cl);
    for (const id of ['m.bp', 'm.uterus', 'm.lochia', 'a.bladder', 'a.danger_pp']) expect(b.has(id), id).toBe(true);
    expect(b.has('d.vaccine.BCG')).toBe(true);
    expect(b.has('d.vaccine.HEPB0')).toBe(true);
    expect(b.has('d.cord_chx')).toBe(true); // Nigeria chlorhexidine policy
  });

  it('jaundice on day 1 is an emergency referral', () => {
    const it = find(cl, 'b.jaundice');
    const f = evaluateFindings(cl, { [it.id]: { itemId: it.id, status: 'value', choice: 'z1' } });
    expect(f[0].urgency).toBe('emergency');
    expect(f[0].action).toBe('refer');
  });

  it('abnormal club foot produces a referral event', () => {
    const it = find(cl, 'b.talipes');
    const results: Record<string, ChecklistResult> = { [it.id]: { itemId: it.id, status: 'value', choice: 'clubfoot_one' } };
    const events = checklistToEvents(cl, results, 'w1', '2026-11-05');
    const ref = events.find((e): e is ReferralEvent => e.kind === 'referral');
    expect(ref).toBeDefined();
    expect(ref!.childId).toBe('c1');
    expect(ref!.reason).toMatch(/Club foot/);
    expect(ref!.status).toBe('open');
    expect(events.some((e) => e.kind === 'visit')).toBe(true);
    // And it reaches the worker as an alert after saving
    const alerts = referralAlerts({ ...m, events: [...m.events, ...events] }, '2026-11-05');
    expect(alerts.some((a) => /Club foot/.test(a.title))).toBe(true);
  });

  it('one-time newborn checks are skipped once recorded', () => {
    const tal = find(cl, 'b.talipes');
    const cleft = find(cl, 'b.cleft');
    const events = checklistToEvents(cl, { [tal.id]: { itemId: tal.id, status: 'value', choice: 'normal' }, [cleft.id]: { itemId: cleft.id, status: 'value', choice: 'normal' } }, 'w1', '2026-11-05');
    const later = buildVisitChecklist({ ...m, events: [...m.events, ...events] }, '2026-11-07');
    expect(later.templateId).toBe('pnc_day3');
    expect(base(later).has('b.talipes')).toBe(false);
    expect(later.skipped.some((s) => s.id === tal.id)).toBe(true);
    expect(base(later).has('b.cord')).toBe(true); // repeated checks stay
  });
});

describe('twins and small babies', () => {
  it('repeats baby checks for both twins and adds KMC for a preterm low-birth-weight baby', () => {
    const t1 = baby('2026-11-02', { id: 't1', name: 'Kehinde', birthWeightKg: 2.1, gestationAtBirthWeeks: 35 });
    const t2 = baby('2026-11-02', { id: 't2', name: 'Taiwo', birthWeightKg: 2.3, gestationAtBirthWeeks: 35 });
    const m = makeMother({ children: [t1, t2], birth: { date: '2026-11-02', mode: 'caesarean', place: 'facility', complications: ['preterm'] } });
    const cl = buildVisitChecklist(m, '2026-11-05');
    expect(cl.children.map((c) => c.name).sort()).toEqual(['Kehinde', 'Taiwo']);
    expect(cl.items.filter((i) => i.baseId === 'b.talipes').length).toBe(2);
    expect(cl.items.filter((i) => i.baseId === 'b.kmc').length).toBe(2);
    expect(base(cl).has('m.wound')).toBe(true); // caesarean
    expect(cl.personalisation.join(' ')).toMatch(/Twins/);
  });
});

describe('9-month child visit, Nigeria', () => {
  const dob = '2026-02-03'; // 275 days on 5 Nov
  const given = ['BCG', 'OPV0', 'HepB0', 'Penta1', 'PCV1', 'OPV1', 'Rota1', 'IPV1', 'Penta2', 'PCV2', 'OPV2', 'Rota2', 'Penta3', 'PCV3', 'OPV3', 'Rota3', 'IPV2', 'Malaria1', 'VitA-100k', 'Malaria2', 'Malaria3'];
  const m = infantMother(dob, 'NG', given);
  const cl = buildVisitChecklist(m, '2026-11-05');

  it('picks the 9-month visit', () => expect(cl.templateId).toBe('child_9m'));

  it('includes measles, yellow fever and meningitis vaccines from the NPHCDA schedule', () => {
    const b = base(cl);
    expect(b.has('d.vaccine.MCV1')).toBe(true);
    expect(b.has('d.vaccine.YF')).toBe(true);
    expect(b.has('d.vaccine.MENA')).toBe(true);
    expect(find(cl, 'd.vaccine.MCV1').title).toMatch(/measles/i);
    const next = find(cl, 't.vaccines_next');
    expect(next.english).toMatch(/vitamin A/);
  });

  it('includes sitting without support (CDC 9 months and WHO window)', () => {
    const b = base(cl);
    expect(b.has('ms.9m.sits')).toBe(true);
    expect(b.has('ms.who.sit')).toBe(true);
    expect(find(cl, 'ms.9m.sits').sources.some((s) => s.id === 'cdc-ltsae-2022')).toBe(true);
    expect(find(cl, 'ms.who.sit').sources.some((s) => s.id === 'who-motor-2006')).toBe(true);
  });

  it('tells her about feeding at this age and the next milestones', () => {
    expect(find(cl, 't.feeding_age').textKey).toBe('nutr.first_foods.9_11');
    expect(find(cl, 't.milestones_next').title).toMatch(/12 months/);
    expect(base(cl).has('b.muac')).toBe(true);
  });

  it('includes the malaria vaccine when doses are missing (catch-up)', () => {
    const m2 = infantMother(dob, 'NG', given.filter((v) => !v.startsWith('Malaria')));
    const cl2 = buildVisitChecklist(m2, '2026-11-05');
    expect(base(cl2).has('d.vaccine.MALARIA1')).toBe(true);
    // Malaria2 waits 4 weeks after Malaria1
    expect(base(cl2).has('d.vaccine.MALARIA2')).toBe(false);
    expect(cl2.skipped.some((s) => /MALARIA2/.test(s.id))).toBe(true);
  });

  it('Kenya and Ghana use their own 9-month antigens', () => {
    const ke = buildVisitChecklist(infantMother(dob, 'KE', ['BCG', 'OPV0', 'Penta1', 'OPV1', 'PCV1', 'Rota1', 'Penta2', 'OPV2', 'PCV2', 'Rota2', 'Penta3', 'OPV3', 'PCV3', 'Rota3', 'IPV1', 'VitA-100k', 'Malaria1', 'Malaria2']), '2026-11-05');
    expect(base(ke).has('d.vaccine.MR1')).toBe(true);
    expect(base(ke).has('d.vaccine.IPV2')).toBe(true);
    expect(base(ke).has('d.vaccine.MCV1')).toBe(false);
    const gh = buildVisitChecklist(infantMother(dob, 'GH', ['BCG', 'OPV0', 'HepB0', 'Penta1', 'OPV1', 'PCV1', 'Rota1', 'Penta2', 'OPV2', 'PCV2', 'Rota2', 'Penta3', 'OPV3', 'PCV3', 'Rota3', 'IPV1', 'VitA-100k', 'Malaria1', 'Malaria2', 'IPV2']), '2026-11-05');
    expect(base(gh).has('d.vaccine.MALARIA3')).toBe(true);
    expect(base(gh).has('d.vaccine.MR1')).toBe(true);
  });

  it('corrects the milestone age for a preterm baby', () => {
    const pre = buildVisitChecklist(infantMother(dob, 'NG', given, { gestationAtBirthWeeks: 30, birthWeightKg: 1.4 }), '2026-11-05');
    // 275 days minus 10 weeks = 205 days (6.7 months): 6-month milestones, not 9
    expect(base(pre).has('ms.6m.rolls')).toBe(true);
    expect(base(pre).has('ms.9m.sits')).toBe(false);
    expect(pre.children[0].correctedAgeDays).toBe(205);
  });
});

describe('risk-driven personalisation', () => {
  it('an SCD mother’s ANC checklist includes crisis and hydration checks and SCD folic acid, not routine iron', () => {
    const m = makeMother({ genotype: 'SS', conditions: ['sickle_cell_disease'], pregnancy: { lmp: '2026-05-14', fetuses: 1 } }); // 25 weeks
    const cl = buildVisitChecklist(m, '2026-11-05');
    expect(cl.stage).toBe('pregnancy');
    const b = base(cl);
    expect(b.has('a.scd_crisis')).toBe(true);
    expect(b.has('a.scd_hydration')).toBe(true);
    expect(b.has('d.folic_scd')).toBe(true);
    expect(b.has('d.ifa')).toBe(false);
    expect(b.has('t.scd_care')).toBe(true);
    expect(find(cl, 'a.scd_crisis').priority).toBe(1);
    expect(cl.personalisation.some((p) => /Sickle cell/.test(p))).toBe(true);
    // Crisis items come before routine asks
    const asks = cl.sections.find((s) => s.id === 'ask')!.items.map((i) => i.baseId);
    expect(asks.indexOf('a.scd_crisis')).toBeLessThan(asks.indexOf('a.common_sx'));
  });

  it('an HIV mother gets ART adherence; her baby gets prophylaxis and early infant diagnosis', () => {
    const anc = buildVisitChecklist(makeMother({ conditions: ['hiv'], pregnancy: { lmp: '2026-05-14', fetuses: 1 } }), '2026-11-05');
    expect(base(anc).has('a.hiv_art')).toBe(true);
    expect(base(anc).has('d.hiv')).toBe(false);
    const pnc = buildVisitChecklist(newbornMother('2026-11-04', { conditions: ['hiv'] }), '2026-11-05');
    expect(base(pnc).has('d.infant_arv')).toBe(true);
    const six = buildVisitChecklist(infantMother('2026-09-22', 'NG', ['BCG', 'OPV0', 'HepB0']), '2026-11-05');
    expect(six.templateId).toBe('pnc_6wk');
    const sixHiv = buildVisitChecklist({ ...infantMother('2026-09-22', 'NG', ['BCG', 'OPV0', 'HepB0']), conditions: ['hiv'] }, '2026-11-05');
    expect(base(sixHiv).has('d.eid')).toBe(true);
    expect(base(sixHiv).has('d.vaccine.PENTA1')).toBe(true);
  });

  it('a previous caesarean adds a scar check late in pregnancy', () => {
    const cl = buildVisitChecklist(makeMother({ previousCaesarean: true, pregnancy: { lmp: '2026-03-26', fetuses: 1 } }), '2026-11-05'); // 32 weeks
    expect(base(cl).has('m.scar')).toBe(true);
    expect(find(cl, 'd.birth_plan').title).toMatch(/hospital/);
  });

  it('low milk supply adds latch observation, feed count and wet nappies', () => {
    const m = infantMother('2026-09-10', 'NG', ['BCG', 'OPV0', 'HepB0', 'Penta1', 'PCV1', 'OPV1', 'Rota1', 'IPV1']);
    m.events.push(ev<FeedingEvent>({ kind: 'feeding', at: '2026-11-01T10:00:00Z', childId: 'c1', status: 'exclusive_breastfeeding', milkSupply: 'low' }));
    const cl = buildVisitChecklist(m, '2026-11-05');
    const b = base(cl);
    expect(b.has('b.latch')).toBe(true);
    expect(b.has('b.feeds')).toBe(true);
    expect(b.has('t.more_milk')).toBe(true);
  });

  it('skips tests already done this pregnancy', () => {
    const m = makeMother({
      pregnancy: { lmp: '2026-08-06', fetuses: 1 }, // 13 weeks
      events: [ev<LabEvent>({ kind: 'lab', at: '2026-10-20T09:00:00Z', test: 'hiv', value: 'negative' }), ev<LabEvent>({ kind: 'lab', at: '2026-10-20T09:00:00Z', test: 'syphilis', value: 'negative' })],
    });
    const cl = buildVisitChecklist(m, '2026-11-05', { visitTemplateId: 'anc1' });
    expect(base(cl).has('d.hiv')).toBe(false);
    expect(base(cl).has('d.syphilis')).toBe(false);
    expect(cl.skipped.some((s) => s.id === 'd.hiv')).toBe(true);
  });
});

describe('results to events', () => {
  it('produces events the engine accepts, and a severe BP raises the engine alert', () => {
    const m = makeMother({ pregnancy: { lmp: '2026-04-23', fetuses: 1 } }); // 28 weeks
    const cl = buildVisitChecklist(m, '2026-11-05');
    const results: Record<string, ChecklistResult> = {};
    const r = (baseId: string, v: Omit<ChecklistResult, 'itemId'>) => {
      const it = find(cl, baseId);
      results[it.id] = { itemId: it.id, ...v };
    };
    r('m.bp', { status: 'value', value: 168, value2: 112 });
    r('m.bp_recheck', { status: 'value', value: 165, value2: 110 });
    r('a.danger_preg', { status: 'abnormal', choices: ['severe_headache'] });
    r('m.temp', { status: 'value', value: 36.8 });
    r('m.weight', { status: 'value', value: 68 });
    r('m.fundal', { status: 'value', value: 28 });
    r('d.ifa', { status: 'done' });
    r('d.urine_protein', { status: 'value', choice: '2' });
    r('t.danger_preg', { status: 'told' });
    results['bk.next'] = { itemId: 'bk.next', status: 'booked', date: '2026-11-19' };

    const events = checklistToEvents(cl, results, 'w1', '2026-11-05');
    const kinds = events.map((e) => e.kind);
    for (const k of ['visit', 'vitals', 'lab', 'medication', 'symptom', 'referral']) expect(kinds, k).toContain(k);
    const visit = events.find((e) => e.kind === 'visit')!;
    expect(visit.kind === 'visit' && visit.visitType === 'anc' && visit.attended).toBe(true);
    const vit = events.find((e) => e.kind === 'vitals')!;
    expect(vit.kind === 'vitals' && vit.systolic).toBe(165); // the confirmed reading wins
    const sym = events.find((e): e is SymptomEvent => e.kind === 'symptom')!;
    expect(sym.symptoms).toContain('severe_headache');
    const ref = events.find((e): e is ReferralEvent => e.kind === 'referral')!;
    expect(ref.urgency).toBe('emergency');

    const after: Mother = { ...m, events: [...m.events, ...events] };
    const plan = buildPlan(after, '2026-11-05', ctx);
    expect(plan.alerts.some((a) => a.level === 'emergency' && /pre-eclampsia|eclampsia/i.test(a.title))).toBe(true);
    const s = deriveState(after, '2026-11-05');
    expect(s.ancContactsAttended).toBe(1);
    expect(s.latest.systolic).toBe(165);
  });

  it('every template builds for every seed mother and its events run through the engine', () => {
    const seed = createSeedState();
    for (const m of seed.mothers) {
      const due = dueTemplateId(m, seed.clock);
      const cl = buildVisitChecklist(m, seed.clock, { visitTemplateId: due });
      expect(cl.items.length, `${m.name} ${due}`).toBeGreaterThan(5);
      // Answer every item with its first (usually normal) option
      const results: Record<string, ChecklistResult> = {};
      for (const it of cl.items) {
        const inp = it.input;
        const id = it.id;
        if (inp.kind === 'choice') results[id] = { itemId: id, status: 'value', choice: inp.options[0].value };
        else if (inp.kind === 'normal_abnormal') results[id] = { itemId: id, status: 'normal' };
        else if (inp.kind === 'done') results[id] = { itemId: id, status: 'done' };
        else if (inp.kind === 'told') results[id] = { itemId: id, status: 'told' };
        else if (inp.kind === 'milestone') results[id] = { itemId: id, status: 'achieved' };
        else if (inp.kind === 'multi') results[id] = { itemId: id, status: 'normal', choices: [] };
      }
      const events: ClinicalEvent[] = checklistToEvents(cl, results, 'w1', seed.clock);
      expect(events.filter((e) => e.kind === 'referral').length, m.name).toBe(0);
      const plan = buildPlan({ ...m, events: [...m.events, ...events] }, seed.clock, ctx);
      expect(plan.items.length).toBeGreaterThan(0);
    }
  });

  it('a pregnant mother with no events defaults to the right ANC contact', () => {
    expect(dueTemplateId(makeMother({ pregnancy: { lmp: '2026-08-20', fetuses: 1 } }), '2026-11-05')).toBe('anc1'); // 11 weeks
    expect(dueTemplateId(makeMother({ pregnancy: { lmp: '2026-04-23', fetuses: 1 } }), '2026-11-05')).toBe('anc4'); // 28 weeks
    expect(dueTemplateId(makeMother(), '2026-11-05')).toBe('preconception');
  });

  it('EPDS self-harm answer is an emergency regardless of score', () => {
    const m = infantMother('2026-09-22', 'NG', ['BCG', 'OPV0', 'HepB0']);
    const cl = buildVisitChecklist(m, '2026-11-05');
    const it = find(cl, 'm.epds');
    const f = evaluateFindings(cl, { [it.id]: { itemId: it.id, status: 'value', value: 6, selfHarm: true } });
    expect(f[0].urgency).toBe('emergency');
    const events = checklistToEvents(cl, { [it.id]: { itemId: it.id, status: 'value', value: 6, selfHarm: true } }, 'w1', '2026-11-05');
    const plan = buildPlan({ ...m, events: [...m.events, ...events] }, '2026-11-05', ctx);
    expect(plan.alerts.some((a) => a.id === 'alert.self_harm')).toBe(true);
  });
});
