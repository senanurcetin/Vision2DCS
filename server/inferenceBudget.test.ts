import { describe, expect, it } from 'vitest';
import { createInferenceRequestCap, MAX_AI_REQUEST_CAP, parseAiRequestCap } from './inferenceBudget';

describe('per-process AI invocation cap (offline)', () => {
  it('allows only explicit, bounded positive decimal configuration', () => {
    for (const bad of [undefined, '', '0', '-1', '1.2', ' 1', '1 ', '+1', '01', '1001', '9999999999999999999', 'NaN']) {
      expect(parseAiRequestCap(bad)).toBeNull();
    }
    expect(parseAiRequestCap('1')).toBe(1);
    expect(parseAiRequestCap('25')).toBe(25);
    expect(parseAiRequestCap('1000')).toBe(MAX_AI_REQUEST_CAP);
  });

  it('reserves synchronously and never resets or refunds after exhaustion', () => {
    const reserve = createInferenceRequestCap(2);
    expect([reserve(), reserve(), reserve(), reserve()]).toEqual([true, true, false, false]);
  });

  it('rejects invalid process cap construction', () => {
    for (const n of [0, -2, 1.3, Number.POSITIVE_INFINITY, 1001, Number.NaN]) {
      expect(() => createInferenceRequestCap(n)).toThrow(RangeError);
    }
  });
});
