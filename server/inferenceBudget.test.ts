import { describe, expect, it } from 'vitest';
import { createInferenceConcurrencyGate, createInferenceRequestCap, MAX_AI_CONCURRENT, MAX_AI_REQUEST_CAP, parseAiConcurrency, parseAiRequestCap } from './inferenceBudget';

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

describe('synchronous paid-model concurrency slots', () => {
  it('parses only explicit integer values from one to eight', () => {
    for (const value of [undefined, '', '0', '9', '10', '+1', '-1', ' 2', '02', '1.5']) {
      expect(parseAiConcurrency(value)).toBeNull();
    }
    expect(parseAiConcurrency('1')).toBe(1);
    expect(parseAiConcurrency('8')).toBe(MAX_AI_CONCURRENT);
  });

  it('caps in-flight operations and releases a slot exactly once', () => {
    const acquire = createInferenceConcurrencyGate(2);
    const first = acquire(), second = acquire();
    expect(typeof first).toBe('function');
    expect(typeof second).toBe('function');
    expect(acquire()).toBeNull();
    first?.();
    first?.(); // double release must not produce a third usable slot
    const third = acquire();
    expect(typeof third).toBe('function');
    expect(acquire()).toBeNull();
    second?.();
    third?.();
    expect(typeof acquire()).toBe('function');
  });

  it('refuses misconfigured concurrency gates', () => {
    for (const value of [0, -1, 1.3, 9, NaN, Infinity]) {
      expect(() => createInferenceConcurrencyGate(value)).toThrow(RangeError);
    }
  });
});
