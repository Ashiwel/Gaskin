import { describe, expect, it } from 'vitest';
import { EPDS, epdsScore } from './epdsData';

describe('EPDS', () => {
  it('has the 10 standard questions with 4 answers each, scored 0 to 3', () => {
    expect(EPDS).toHaveLength(10);
    for (const q of EPDS) {
      expect(q.opts).toHaveLength(4);
      expect(q.opts.map(([, s]) => s).sort()).toEqual([0, 1, 2, 3]);
    }
  });
  it('reverse-scores items 3 and 5 to 10 (first answer scores 3)', () => {
    for (const i of [2, 4, 5, 6, 7, 8, 9]) expect(EPDS[i].opts[0][1]).toBe(3);
    for (const i of [0, 1, 3]) expect(EPDS[i].opts[0][1]).toBe(0);
  });
  it('totals the score and flags item 10', () => {
    const r = epdsScore([0, 0, 3, 2, 2, 2, 1, 2, 1, 1]);
    expect(r).toEqual({ score: 14, complete: true, selfHarm: true });
    expect(epdsScore([0, null, 0, 0, 0, 0, 0, 0, 0, 0]).complete).toBe(false);
  });
});
