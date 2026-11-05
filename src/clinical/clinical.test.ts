import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, CITATIONS, EVIDENCE_LABELS, IMMUNISATION_SCHEDULES, LOCAL_FOODS, TRADITIONAL_PRACTICES, findPractice } from './index';

describe('clinical knowledge base', () => {
  it('has at least 18 traditional practices spanning all three countries and all four grades', () => {
    expect(TRADITIONAL_PRACTICES.length).toBeGreaterThanOrEqual(18);
    for (const c of ['NG', 'KE', 'GH'] as const) expect(TRADITIONAL_PRACTICES.some((p) => p.countries.includes(c))).toBe(true);
    for (const g of ['trad_supported', 'trad_plausible', 'trad_neutral', 'trad_harmful'] as const) expect(TRADITIONAL_PRACTICES.some((p) => p.grade === g)).toBe(true);
  });

  it('every practice has unique id, guidance, mother text and at least one source', () => {
    const ids = new Set<string>();
    for (const p of TRADITIONAL_PRACTICES) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.guidance.length).toBeGreaterThan(20);
      expect(p.motherText.length).toBeGreaterThan(10);
      expect(p.sources.length).toBeGreaterThan(0);
    }
  });

  it('includes the required practices', () => {
    for (const id of ['omugwo', 'hot_water_compress', 'pap_ogi', 'pepper_soup', 'galactagogue_leaves', 'agbo', 'nzu_clay', 'food_taboo_protein', 'wankan_jego', 'colostrum_discard', 'prelacteal_feeds', 'cord_substances', 'uvulectomy', 'baby_massage_shea', 'postpartum_confinement']) {
      expect(findPractice(id), id).toBeTruthy();
    }
    expect(findPractice('nzu')?.id).toBe('nzu_clay');
  });

  it('wankan jego is not graded as proven harm (PEACE registry)', () => {
    expect(findPractice('wankan_jego')!.grade).not.toBe('trad_harmful');
    expect(findPractice('wankan_jego')!.sources.map((s) => s.id)).toContain('peace-2020');
  });

  it('citations have https urls', () => {
    for (const c of Object.values(CITATIONS)) expect(c.url ?? '').toMatch(/^https:\/\//);
  });

  it('immunisation schedules start at birth and are sorted', () => {
    for (const sched of Object.values(IMMUNISATION_SCHEDULES)) {
      expect(sched[0].ageDays).toBe(0);
      expect(sched.map((v) => v.ageDays)).toEqual([...sched.map((v) => v.ageDays)].sort((a, b) => a - b));
    }
  });

  it('each country has cheap iron, protein, calcium and vitamin A foods', () => {
    for (const foods of Object.values(LOCAL_FOODS)) {
      for (const n of ['iron', 'protein', 'calcium', 'vitamin_a'] as const) expect(foods.some((f) => f.costTier === 'cheap' && f.nutrients.includes(n))).toBe(true);
    }
  });

  it('labels cover every category and grade', () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(16);
    expect(Object.keys(EVIDENCE_LABELS)).toHaveLength(8);
  });
});
