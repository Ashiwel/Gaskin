import { describe, expect, it } from 'vitest';
import type { BirthEvent, Child, FeedingEvent, LabEvent, Mother, ScreeningEvent, SymptomEvent, VitalsEvent } from '../types';
import { MOTHER_TEXT, PLAN_TEXT, TRADITIONAL_PRACTICES } from '../clinical';
import { buildPlan } from './index';
import { ev, makeMother } from './fixtures.test-helpers';

/**
 * motherText is the source for translation packs: plain words, one idea per sentence,
 * under 15 words a sentence, no clinical jargon.
 */
export const JARGON = /\b(anaemi\w*|anemi\w*|pre-?eclampsia|eclampsia|IPTp|gestation\w*|postpartum|postnatal|antenatal|EPDS|colostrum|complementary|haemoglobin|hemoglobin|Hb|ART|PMTCT|chlorhexidine|trimester|prophylaxis|lactation|galactagogue\w*|hypertension|perineum|contraception|supine|fetal|foetal|neonat\w*|deworming|SP)\b/i;

export function sentences(t: string): string[] {
  return t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /[A-Za-z0-9₦]/.test(w)).length;
}

const T = '2026-11-05';
const kid = (dob: string, over: Partial<Child> = {}): Child => ({ id: 'c1', name: 'Chidi', sex: 'M', dob, birthWeightKg: 3.1, gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding', ...over });
const allPractices = TRADITIONAL_PRACTICES.map((p) => p.id);

function scenarios(): Mother[] {
  const births = (dob: string, child: Child, comps: BirthEvent['birth']['complications'] = ['none'], mode: BirthEvent['birth']['mode'] = 'vaginal') =>
    ev<BirthEvent>({ kind: 'birth', at: `${dob}T06:00:00Z`, birth: { date: dob, mode, place: 'home', complications: comps, bloodLossMl: comps.includes('pph') ? 800 : undefined }, child });
  const out: Mother[] = [];
  for (const literacy of ['good', 'none'] as const) {
    for (const country of ['NG', 'KE', 'GH'] as const) {
      const region = country === 'KE' ? 'Kisumu' : country === 'GH' ? 'Northern' : 'Kano';
      const base = { literacy, country, region, practicesMentioned: allPractices };
      // Pregnancy, high risk, many findings.
      out.push(
        makeMother({
          ...base,
          age: 16,
          parity: 0,
          gravida: 1,
          incomeBand: 'very_low',
          conditions: ['pre_eclampsia_history', 'hiv', 'depression_history'],
          genotype: 'unknown',
          pregnancy: { lmp: '2026-04-01', fetuses: 2, plannedBirthPlace: 'tba' },
          events: [
            ev<VitalsEvent>({ kind: 'vitals', at: `${T}T09:00:00Z`, systolic: 150, diastolic: 95, temperatureC: 38.4 }),
            ev<LabEvent>({ kind: 'lab', at: `${T}T09:00:00Z`, test: 'haemoglobin', value: 8.5 }),
            ev<SymptomEvent>({ kind: 'symptom', at: `${T}T09:00:00Z`, symptoms: ['nausea_vomiting', 'heartburn', 'leg_cramps', 'constipation', 'back_pain', 'low_mood'], via: 'visit' }),
            ev<ScreeningEvent>({ kind: 'screening', at: `${T}T09:00:00Z`, instrument: 'epds', score: 11 }),
          ],
        }),
      );
      out.push(makeMother({ ...base, genotype: 'SS', conditions: ['sickle_cell_disease', 'gestational_diabetes'], pregnancy: { lmp: '2026-08-20', fetuses: 1 } }));
      out.push(makeMother({ ...base, incomeBand: 'high', pregnancy: { lmp: '2026-02-20', fetuses: 1 } }));
      // Postpartum, small baby, low milk.
      const c = kid('2026-11-01', { birthWeightKg: 2.2, gestationAtBirthWeeks: 35, feeding: 'mixed' });
      out.push(
        makeMother({
          ...base,
          conditions: ['hiv', 'chronic_hypertension'],
          events: [
            births('2026-11-01', c, ['pph', 'pre_eclampsia'], 'caesarean'),
            ev<FeedingEvent>({ kind: 'feeding', at: `${T}T09:00:00Z`, status: 'mixed', milkSupply: 'low', latchProblem: true, childId: 'c1' }),
            ev<ScreeningEvent>({ kind: 'screening', at: `${T}T09:00:00Z`, instrument: 'epds', score: 16 }),
          ],
        }),
      );
      out.push(makeMother({ ...base, genotype: 'SS', conditions: ['sickle_cell_disease'], events: [births('2026-10-10', kid('2026-10-10'))] }));
      // Infant at several ages.
      for (const dob of ['2026-08-01', '2026-05-01', '2026-01-10', '2025-06-01']) {
        out.push(makeMother({ ...base, children: [kid(dob)], birth: { date: dob, mode: 'vaginal', place: 'facility', complications: ['none'] }, events: [ev<ScreeningEvent>({ kind: 'screening', at: `${T}T09:00:00Z`, instrument: 'epds', score: 13 })] }));
      }
      out.push(makeMother({ ...base, genotype: 'SS', conditions: ['sickle_cell_disease'] }));
      out.push(makeMother({ ...base }));
    }
  }
  return out;
}

describe('mother-facing text', () => {
  const texts = new Map<string, string>();
  for (const m of scenarios()) for (const i of buildPlan(m, T, { overrides: [], learnedRules: [] }).items) texts.set(`${i.id} [${m.literacy}/${m.country}]`, i.motherText);
  const keys = new Set<string>();
  const unkeyed: string[] = [];
  for (const m of scenarios()) {
    const p = buildPlan(m, T, { overrides: [], learnedRules: [] });
    for (const i of p.items) {
      if (i.motherTextKey) keys.add(i.motherTextKey);
      else unkeyed.push(i.id);
    }
    for (const a of p.alerts) {
      if (a.motherTextKey) keys.add(a.motherTextKey);
      else unkeyed.push(a.id);
      texts.set(`${a.id} [alert]`, a.motherText ?? '');
    }
  }
  for (const p of TRADITIONAL_PRACTICES) texts.set(`library:${p.id}`, p.motherText);
  for (const [k, t] of Object.entries(MOTHER_TEXT)) texts.set(`template:${k}`, t);
  for (const [k, t] of Object.entries(PLAN_TEXT)) texts.set(`template:${k}`, t);

  it('every item and alert carries a template key from MOTHER_TEXT or PLAN_TEXT', () => {
    expect(unkeyed).toEqual([]);
    for (const k of keys) expect(MOTHER_TEXT[k] ?? PLAN_TEXT[k], k).toBeDefined();
  });

  it('templates render with no leftover placeholders', () => {
    const left = [...texts].filter(([k, t]) => !k.startsWith('template:') && /\{\w+\}/.test(t));
    expect(left).toEqual([]);
  });

  it('has no clinical jargon', () => {
    const bad = [...texts].filter(([, t]) => JARGON.test(t)).map(([k, t]) => `${k}: ${t}`);
    expect(bad).toEqual([]);
  });

  it('keeps every sentence under 15 words', () => {
    const bad = [...texts].flatMap(([k, t]) => sentences(t).filter((s) => wordCount(s) >= 15).map((s) => `${k}: ${s}`));
    expect(bad).toEqual([]);
  });

  it('never defaults to Nigerian Pidgin', () => {
    const bad = [...texts].filter(([, t]) => /\b(abeg|wetin|dey|una|pikin|sabi)\b/i.test(t));
    expect(bad).toEqual([]);
  });
});
