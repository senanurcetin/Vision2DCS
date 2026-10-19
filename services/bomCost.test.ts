import { describe, it, expect } from 'vitest';
import { estimatedUnitCost, summarizeEstimatedBom } from './bomCost';

describe('conceptual BOM cost guard', () => {
  it('distinguishes real zero from unavailable and invalid estimates', () => {
    expect(estimatedUnitCost(0)).toBe(0);
    expect(estimatedUnitCost(150.5)).toBe(150.5);
    for (const value of [null, undefined, '0', -1, Number.NaN, Infinity, 1e20]) {
      expect(estimatedUnitCost(value)).toBeUndefined();
    }
  });
  it('discloses incomplete coverage', () => {
    expect(summarizeEstimatedBom([
      { estimatedCost: 100.5 }, { estimatedCost: -2 }, {},
      { estimatedCost: 0 }, { estimatedCost: NaN },
    ])).toEqual({ total: 100.5, estimatedCount: 2, missingCount: 3, isComplete: false });
  });
});
