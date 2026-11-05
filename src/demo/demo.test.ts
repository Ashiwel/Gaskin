import { describe, expect, it } from 'vitest';
import { SCENARIOS, advanceClock } from './index';
import { createSeedState } from '../data';
import { DEMO_STARS } from '../data/seed';
import { buildPlan, deriveState } from '../engine';
import type { ClinicalEvent, DemoState } from '../types';

const seed = createSeedState();
const ctx = (s: DemoState) => ({ overrides: s.overrides, learnedRules: s.learnedRules });
const sc = (id: string) => SCENARIOS.find((s) => s.id === id)!;
const mother = (s: DemoState, id: string) => s.mothers.find((m) => m.id === id)!;
const added = (before: DemoState, after: DemoState, id: string): ClinicalEvent[] => mother(after, id).events.slice(mother(before, id).events.length);

const EXPECT: Record<string, { mother: string; kinds: ClinicalEvent['kind'][] }> = {
  bp_rise: { mother: DEMO_STARS.adaeze, kinds: ['vitals', 'lab', 'symptom'] },
  anaemia_lab: { mother: DEMO_STARS.adaeze, kinds: ['lab'] },
  epds_high: { mother: DEMO_STARS.funke, kinds: ['screening'] },
  epds_selfharm: { mother: DEMO_STARS.funke, kinds: ['screening'] },
  low_milk: { mother: 'm-ng-yetunde', kinds: ['feeding'] },
  give_birth: { mother: DEMO_STARS.adaeze, kinds: ['birth'] },
  newborn_danger: { mother: DEMO_STARS.funke, kinds: ['symptom'] },
  missed_visit: { mother: DEMO_STARS.hauwa, kinds: ['visit'] },
  doctor_report: { mother: DEMO_STARS.adaeze, kinds: ['report'] },
  whatsapp_symptom: { mother: DEMO_STARS.adaeze, kinds: ['symptom'] },
  malaria_positive: { mother: DEMO_STARS.hauwa, kinds: ['lab'] },
  gdm_ogtt: { mother: DEMO_STARS.adaeze, kinds: ['lab'] },
  growth_faltering: { mother: 'm-ng-kaltuma', kinds: ['growth'] },
};

describe('scenarios', () => {
  it('covers every required scenario', () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual(Object.keys(EXPECT).sort());
  });

  for (const [id, exp] of Object.entries(EXPECT)) {
    it(`${id} adds the expected events without mutating`, () => {
      const before = createSeedState();
      const snapshot = JSON.stringify(before);
      const m = mother(before, exp.mother);
      expect(sc(id).appliesTo(m, deriveState(m, before.clock))).toBe(true);
      const after = sc(id).apply(before, exp.mother);
      expect(JSON.stringify(before)).toBe(snapshot);
      expect(after).not.toBe(before);
      const evs = added(before, after, exp.mother);
      for (const k of exp.kinds) expect(evs.some((e) => e.kind === k), `${id}: ${k}`).toBe(true);
      // ids unique, all at or before the clock, timeline still sorted
      const all = mother(after, exp.mother).events;
      expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
      for (const e of evs) expect(Date.parse(e.at)).toBeLessThanOrEqual(Date.parse(after.clock));
      for (let i = 1; i < all.length; i++) expect(all[i].at >= all[i - 1].at).toBe(true);
      // the plan still builds
      expect(() => buildPlan(mother(after, exp.mother), after.clock, ctx(after))).not.toThrow();
    });
  }

  it('details: values and parsed WhatsApp', () => {
    const bp = added(seed, sc('bp_rise').apply(seed, DEMO_STARS.adaeze), DEMO_STARS.adaeze);
    expect(bp.find((e) => e.kind === 'vitals')).toMatchObject({ systolic: 152, diastolic: 100 });
    expect(bp.find((e) => e.kind === 'lab')).toMatchObject({ test: 'urine_protein', value: 2 });
    expect(added(seed, sc('anaemia_lab').apply(seed, DEMO_STARS.adaeze), DEMO_STARS.adaeze)[0]).toMatchObject({ test: 'haemoglobin', value: 7.8 });
    expect(added(seed, sc('gdm_ogtt').apply(seed, DEMO_STARS.adaeze), DEMO_STARS.adaeze).find((e) => e.kind === 'lab' && e.test === 'ogtt_2h')).toMatchObject({ value: 9.1 });
    expect(added(seed, sc('epds_selfharm').apply(seed, DEMO_STARS.funke), DEMO_STARS.funke)[0]).toMatchObject({ score: 18, selfHarmFlag: true });
    const rep = added(seed, sc('doctor_report').apply(seed, DEMO_STARS.adaeze), DEMO_STARS.adaeze)[0];
    expect(rep.kind === 'report' && rep.extracted).toBeFalsy();
    expect(rep.kind === 'report' && rep.text).toMatch(/BP \d+\/\d+.*Hb [\d.]+.*methyldopa/s);
    const wa = sc('whatsapp_symptom').apply(seed, DEMO_STARS.adaeze);
    expect(wa.inbound.length).toBe(seed.inbound.length + 1);
    const sym = added(seed, wa, DEMO_STARS.adaeze)[0];
    expect(sym).toMatchObject({ kind: 'symptom', via: 'whatsapp' });
    expect(sym.kind === 'symptom' && sym.symptoms).toEqual(expect.arrayContaining(['severe_headache', 'swelling_face_hands']));
    const missed = added(seed, sc('missed_visit').apply(seed, DEMO_STARS.hauwa), DEMO_STARS.hauwa)[0];
    expect(missed).toMatchObject({ kind: 'visit', attended: false });
  });

  it('give_birth moves her to postpartum with a child', () => {
    const after = sc('give_birth').apply(seed, DEMO_STARS.adaeze);
    const m = mother(after, DEMO_STARS.adaeze);
    expect(m.children).toHaveLength(2);
    expect(deriveState(m, after.clock).stage).toBe('postpartum');
    const twins = sc('give_birth').apply(seed, 'm-ng-bukola');
    expect(mother(twins, 'm-ng-bukola').events.filter((e) => e.kind === 'birth')).toHaveLength(2);
    expect(mother(twins, 'm-ng-bukola').birth?.mode).toBe('caesarean');
  });

  // doctor_report only adds free text: the plan changes after AI extraction is confirmed (UI step), so it is excluded here.
  it('every scenario changes the plan for its demo mother', () => {
    for (const [id, exp] of Object.entries(EXPECT)) {
      if (id === 'doctor_report') continue;
      const m0 = mother(seed, exp.mother);
      const p0 = buildPlan(m0, seed.clock, ctx(seed));
      const s1 = sc(id).apply(seed, exp.mother);
      const p1 = buildPlan(mother(s1, exp.mother), s1.clock, { ...ctx(s1), previous: { version: 1, itemIds: p0.items.map((i) => i.id), alertIds: p0.alerts.map((a) => a.id) } });
      const st0 = deriveState(m0, seed.clock);
      const st1 = deriveState(mother(s1, exp.mother), s1.clock);
      const changed =
        JSON.stringify(p0.items.map((i) => [i.id, i.status, i.detail])) !== JSON.stringify(p1.items.map((i) => [i.id, i.status, i.detail])) ||
        JSON.stringify(p0.alerts.map((a) => a.id)) !== JSON.stringify(p1.alerts.map((a) => a.id)) ||
        JSON.stringify(st0.risks.map((r) => r.code + r.reason)) !== JSON.stringify(st1.risks.map((r) => r.code + r.reason)) ||
        JSON.stringify(st0.recentSymptoms) !== JSON.stringify(st1.recentSymptoms) ||
        p0.summary !== p1.summary ||
        JSON.stringify(p0.nextContact) !== JSON.stringify(p1.nextContact);
      expect(changed, id).toBe(true);
    }
  });

  it('every applicable scenario changes the plan for every seeded mother', () => {
    const misses: string[] = [];
    for (const m0 of seed.mothers) {
      const st0 = deriveState(m0, seed.clock);
      const p0 = buildPlan(m0, seed.clock, ctx(seed));
      for (const s of SCENARIOS) {
        if (!s.appliesTo(m0, st0)) continue;
        const s1 = s.apply(seed, m0.id);
        const m1 = mother(s1, m0.id);
        const p1 = buildPlan(m1, s1.clock, ctx(s1));
        const st1 = deriveState(m1, s1.clock);
        const same =
          JSON.stringify([p0.items.map((i) => [i.id, i.status, i.detail, i.priority]), p0.alerts.map((a) => a.id), st0.risks.map((r) => r.code + r.reason), st0.recentSymptoms, p0.summary, p0.nextContact]) ===
          JSON.stringify([p1.items.map((i) => [i.id, i.status, i.detail, i.priority]), p1.alerts.map((a) => a.id), st1.risks.map((r) => r.code + r.reason), st1.recentSymptoms, p1.summary, p1.nextContact]);
        if (same && s.id !== 'doctor_report') misses.push(`${s.id}:${m0.id}`);
      }
    }
    expect(misses).toEqual([]);
  });

  it('bp_rise produces an emergency or urgent alert', () => {
    for (const id of [DEMO_STARS.adaeze, DEMO_STARS.hauwa, DEMO_STARS.funke]) {
      const s1 = sc('bp_rise').apply(seed, id);
      const plan = buildPlan(mother(s1, id), s1.clock, ctx(s1));
      expect(plan.alerts.some((a) => a.level === 'emergency' || a.level === 'urgent'), id).toBe(true);
    }
  });

  it('newborn_danger and epds_selfharm raise emergencies', () => {
    for (const id of ['newborn_danger', 'epds_selfharm']) {
      const s1 = sc(id).apply(seed, DEMO_STARS.funke);
      expect(buildPlan(mother(s1, DEMO_STARS.funke), s1.clock, ctx(s1)).alerts.some((a) => a.level === 'emergency'), id).toBe(true);
    }
  });

  it('appliesTo uses stage', () => {
    const preg = mother(seed, DEMO_STARS.adaeze);
    const pp = mother(seed, DEMO_STARS.funke);
    expect(sc('newborn_danger').appliesTo(preg, deriveState(preg, seed.clock))).toBe(false);
    expect(sc('gdm_ogtt').appliesTo(pp, deriveState(pp, seed.clock))).toBe(false);
    expect(sc('give_birth').appliesTo(pp, deriveState(pp, seed.clock))).toBe(false);
  });

  it('advanceClock moves time and leaves events alone', () => {
    const s1 = advanceClock(seed, 7);
    expect(Date.parse(s1.clock) - Date.parse(seed.clock)).toBe(7 * 86_400_000);
    expect(s1.mothers).toBe(seed.mothers);
    expect(deriveState(mother(s1, DEMO_STARS.funke), s1.clock).daysPostpartum).toBe(12);
  });
});
