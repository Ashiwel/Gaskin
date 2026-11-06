import { describe, expect, it } from 'vitest';
import { COUNTRIES, DEMO_START_CLOCK, LANGUAGE_NAMES, createSeedState } from './index';
import { DEMO_STARS } from './seed';
import { buildPlan, deriveState, gestationalWeeks } from '../engine';
import { findPractice } from '../clinical/traditional';

const seed = createSeedState();
const clockMs = Date.parse(DEMO_START_CLOCK);

describe('countries', () => {
  it('has NG, KE and GH with channel costs for every channel', () => {
    for (const c of Object.values(COUNTRIES)) {
      for (const ch of ['sms', 'whatsapp', 'email', 'voice', 'print'] as const) {
        expect(c.channelCosts.some((x) => x.channel === ch), `${c.code} ${ch}`).toBe(true);
      }
      expect(c.regions.length).toBeGreaterThanOrEqual(4);
      expect(c.guidelineSources.length).toBeGreaterThan(2);
    }
    // Nigeria SMS: MTN bulk ₦2.15 at ₦1,329.12/$
    const ngSms = COUNTRIES.NG.channelCosts.find((x) => x.channel === 'sms')!;
    expect(ngSms.unitCostLocal).toBe(2.15);
    expect(ngSms.unitCostUSD).toBeCloseTo(2.15 / 1329.12, 5);
    expect(COUNTRIES.NG.channelCosts.filter((x) => x.channel === 'whatsapp')).toHaveLength(2);
  });
  it('names every language code', () => {
    for (const c of Object.values(COUNTRIES)) for (const l of c.languages) expect(LANGUAGE_NAMES[l]).toBeTruthy();
  });
});

describe('seed', () => {
  it('is deterministic', () => {
    expect(createSeedState()).toEqual(createSeedState());
  });

  it('has the demo stars first and a realistic spread', () => {
    expect(seed.mothers.slice(0, 5).map((m) => m.id)).toEqual(Object.values(DEMO_STARS));
    const by = (c: string) => seed.mothers.filter((m) => m.country === c).length;
    expect(by('NG')).toBeGreaterThanOrEqual(22);
    expect(by('KE')).toBe(7);
    expect(by('GH')).toBe(6);
    const stages = seed.mothers.map((m) => deriveState(m, seed.clock).stage);
    for (const st of ['preconception', 'pregnancy', 'postpartum', 'infant']) expect(stages).toContain(st);
    const langs = new Set(seed.mothers.map((m) => m.language));
    for (const l of ['en', 'pcm', 'yo', 'ig', 'ha', 'sw', 'tw']) expect(langs.has(l as never), l).toBe(true);
    expect(new Set(seed.mothers.map((m) => m.phone.access))).toEqual(new Set(['none', 'shared', 'feature', 'smartphone']));
    expect(seed.workers.find((w) => w.id === seed.currentWorkerId)?.role).toBe('midwife');
    expect(seed.workers.some((w) => w.isClinicalReviewer)).toBe(true);
  });

  it('matches the demo star briefs', () => {
    const a = seed.mothers.find((m) => m.id === DEMO_STARS.adaeze)!;
    expect(a.name).toBe('Adaeze Okafor');
    expect(gestationalWeeks(a.pregnancy!.lmp, seed.clock)).toBe(31);
    expect(a.practicesMentioned).toEqual(expect.arrayContaining(['omugwo', 'nzu_clay']));
    const h = seed.mothers.find((m) => m.id === DEMO_STARS.hauwa)!;
    expect(h.age).toBe(17);
    expect(h.consent.guardianInvolved).toBe(true);
    expect(gestationalWeeks(h.pregnancy!.lmp, seed.clock)).toBe(24);
    expect(deriveState(seed.mothers.find((m) => m.id === DEMO_STARS.funke)!, seed.clock).daysPostpartum).toBe(5);
  });

  it('every mother passes basic sanity', () => {
    const ids = new Set<string>();
    for (const m of seed.mothers) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(seed.workers.some((w) => w.id === m.assignedWorkerId), m.id).toBe(true);
      expect(seed.facilities.some((f) => f.id === m.facilityId), m.id).toBe(true);
      if (m.phone.number) expect(m.phone.number).toMatch(/^\+(234 800 000 0\d{3}|254 700 000 \d{3}|233 20 000 0\d{3})$/);
      // events sorted, unique ids, none in the future
      const evIds = new Set<string>();
      for (let i = 0; i < m.events.length; i++) {
        const e = m.events[i];
        expect(evIds.has(e.id)).toBe(false);
        evIds.add(e.id);
        expect(Date.parse(e.at), `${m.id} ${e.id}`).toBeLessThanOrEqual(clockMs);
        if (i) expect(e.at >= m.events[i - 1].at, `${m.id} sorted`).toBe(true);
      }
      // gestational age plausible
      const st = deriveState(m, seed.clock);
      if (st.stage === 'pregnancy') {
        expect(st.gestationalWeeks!).toBeGreaterThanOrEqual(4);
        expect(st.gestationalWeeks!).toBeLessThanOrEqual(42);
      }
      // children consistent with births
      const births = m.events.filter((e) => e.kind === 'birth');
      for (const b of births) {
        if (b.kind !== 'birth') continue;
        expect(m.children.some((c) => c.id === b.child.id), `${m.id} child`).toBe(true);
        expect(b.child.dob).toBe(b.birth.date);
      }
      expect(m.parity).toBeLessThanOrEqual(m.gravida);
      expect(m.children.length).toBeLessThanOrEqual(Math.max(m.parity, 0) + 1);
      for (const c of m.children) expect(Date.parse(c.dob)).toBeLessThanOrEqual(clockMs);
      // events for a child refer to a known child
      for (const e of m.events) if (e.childId) expect(m.children.some((c) => c.id === e.childId), `${m.id} ${e.id}`).toBe(true);
      // practices resolve in the library
      for (const p of m.practicesMentioned) expect(findPractice(p), `${m.id} ${p}`).toBeTruthy();
      // adolescents have guardian involvement
      if (m.age < 18) expect(m.consent.guardianInvolved).toBe(true);
    }
  });

  it('has a real pending governance proposal backed by two workers, and an approved rule', () => {
    const pending = seed.proposals.filter((p) => p.status === 'pending');
    expect(pending.some((p) => p.supportingWorkerIds.length >= 2)).toBe(true);
    for (const p of pending) for (const oid of p.supportingOverrideIds) expect(seed.overrides.some((o) => o.id === oid)).toBe(true);
    expect(seed.learnedRules).toHaveLength(1);
    expect(seed.outbound.length).toBeGreaterThan(5);
    expect(seed.inbound.find((i) => i.id === 'in-001')?.parsedSymptoms).toEqual(expect.arrayContaining(['severe_headache', 'swelling_face_hands']));
  });

  it('buildPlan runs for every seeded mother at the demo clock', () => {
    for (const m of seed.mothers) {
      const plan = buildPlan(m, seed.clock, { overrides: seed.overrides, learnedRules: seed.learnedRules });
      expect(plan.items.length, m.id).toBeGreaterThan(0);
    }
  });

  it('the approved SCD hydration rule shows in Folake’s plan', () => {
    const f = seed.mothers.find((m) => m.id === 'm-ng-folake')!;
    const plan = buildPlan(f, seed.clock, { overrides: [], learnedRules: seed.learnedRules });
    expect(plan.items.some((i) => i.id === 'nutr.scd_hydration' && i.origin === 'learned_rule')).toBe(true);
  });
});
