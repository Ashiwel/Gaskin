import { describe, expect, it } from 'vitest';
import type { Mother } from '../../src/types';
import { buildDataValueSets, countMonth, suppress } from '../src/dhis2';
import { mother, visit } from './helpers';

function cohort(n: number, facilityId = 'f-a'): Mother[] {
  return Array.from({ length: n }, (_, i) => mother(`m-${facilityId}-${i}`, facilityId, { events: [visit(`e-${facilityId}-${i}`, '2026-10-05T09:00:00.000Z', 1)] }));
}

describe('DHIS2 export', () => {
  it('counts ANC, births, PNC and vaccines for one month only', () => {
    const m = mother('m-1', 'f-a', {
      events: [
        visit('a1', '2026-10-01T09:00:00.000Z', 1),
        visit('a2', '2026-09-01T09:00:00.000Z', 4),
        { id: 'b', kind: 'birth', at: '2026-10-20T09:00:00.000Z', recordedBy: 'w', birth: { date: '2026-10-20', mode: 'vaginal', place: 'facility', complications: ['none'] }, child: { id: 'c', name: 'Baby', sex: 'F', dob: '2026-10-20', birthWeightKg: 3, gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding' } },
        visit('p1', '2026-10-21T09:00:00.000Z', 1, 'pnc'),
        { id: 'i', kind: 'immunisation', at: '2026-10-20T10:00:00.000Z', recordedBy: 'w', vaccines: ['BCG', 'OPV0', 'HepB0'] },
      ],
    });
    const c = countMonth([m], '202610');
    expect(c).toMatchObject({ GASKIN_ANC_TOTAL: 1, GASKIN_ANC1: 1, GASKIN_ANC4: 0, GASKIN_BIRTHS: 1, GASKIN_BIRTHS_FACILITY: 1, GASKIN_PNC_48H: 1, GASKIN_IMM_BCG: 1, GASKIN_IMM_HEPB0: 1 });
  });

  it('withholds counts from 1 to 9 and reports zeros and counts of 10 or more', () => {
    const exp = buildDataValueSets(
      [
        { facilityId: 'f-big', mothers: cohort(12, 'f-big') },
        { facilityId: 'f-small', mothers: cohort(3, 'f-small') },
      ],
      '202610',
      { suppressBelow: 10, now: '2026-11-05T00:00:00.000Z' },
    );
    const big = exp.dataValueSets.find((s) => s.orgUnit === 'f-big')!;
    const small = exp.dataValueSets.find((s) => s.orgUnit === 'f-small')!;
    expect(big.dataValues.find((d) => d.dataElement === 'GASKIN_ANC1')?.value).toBe('12');
    expect(big.dataValues.find((d) => d.dataElement === 'GASKIN_BIRTHS')?.value).toBe('0');
    // 3 is withheld, not published as 3 and not published as 0
    expect(small.dataValues.find((d) => d.dataElement === 'GASKIN_ANC1')).toBeUndefined();
    expect(small.dataValues.find((d) => d.dataElement === 'GASKIN_ANC_TOTAL')).toBeUndefined();
    expect(exp.suppressed).toEqual(expect.arrayContaining([{ orgUnit: 'f-small', dataElement: 'GASKIN_ANC1' }]));
    for (const s of exp.dataValueSets) for (const d of s.dataValues) expect(Number(d.value) === 0 || Number(d.value) >= 10).toBe(true);
    expect(big.period).toBe('202610');
  });

  it('applies secondary suppression so a hidden part cannot be recovered from the total', () => {
    const r = suppress({ GASKIN_BIRTHS: 25, GASKIN_BIRTHS_FACILITY: 20, GASKIN_BIRTHS_HOME: 5, GASKIN_BIRTHS_TRANSIT: 0 }, 10);
    // HOME (5) is hidden; with TOTAL and FACILITY shown it would be 25 - 20: FACILITY is hidden too
    expect(r.suppressed).toEqual(expect.arrayContaining(['GASKIN_BIRTHS_HOME', 'GASKIN_BIRTHS_FACILITY']));
    expect(r.values.GASKIN_BIRTHS).toBe(25);
  });

  it('maps codes to national UIDs from a mapping file', () => {
    const exp = buildDataValueSets([{ facilityId: 'f-big', mothers: cohort(10, 'f-big') }], '202610', {
      suppressBelow: 10,
      mapping: { dataSet: 'ds123', idScheme: 'UID', dataElements: { GASKIN_ANC1: { dataElement: 'uidANC1', categoryOptionCombo: 'coc1' } }, orgUnits: { 'f-big': 'ouUID' } },
    });
    expect(exp.idScheme).toBe('UID');
    expect(exp.dataValueSets[0]).toMatchObject({ dataSet: 'ds123', orgUnit: 'ouUID' });
    expect(exp.dataValueSets[0].dataValues.find((d) => d.dataElement === 'uidANC1')).toMatchObject({ value: '10', categoryOptionCombo: 'coc1' });
  });
});
