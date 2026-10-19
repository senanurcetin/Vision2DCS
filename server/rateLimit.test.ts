import { describe, expect, it } from 'vitest';
import { createRateLimiter, DEFAULT_MAX_RATE_LIMIT_CLIENTS, pruneExpiredRateLimitWindows } from './rateLimit';

describe('createRateLimiter', () => {
  it('allows up to the limit per window, per client', () => {
    let t = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect([allow('a'), allow('a'), allow('a')]).toEqual([true, true, false]);
    expect(allow('b')).toBe(true);
    t = 999;
    expect(allow('a')).toBe(false);
    t = 1000;
    expect(allow('a')).toBe(true);
  });

  it('removes expired client windows while retaining active windows', () => {
    const windows = new Map([
      ['expired', { start: 0, count: 3 }],
      ['active', { start: 500, count: 1 }],
    ]);
    pruneExpiredRateLimitWindows(windows, 1000, 1000);
    expect([...windows.keys()]).toEqual(['active']);
  });

  it('caps distinct client records, preserving existing allowances and recovering after expiry', () => {
    let t = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 1000, maxClients: 2, now: () => t });
    expect([allow('a'), allow('a'), allow('a'), allow('b'), allow('c')]).toEqual([
      true, true, false, true, false,
    ]);
    expect([allow('b'), allow('b')]).toEqual([true, false]);
    t = 999;
    expect(allow('c')).toBe(false);
    t = 1000;
    expect(allow('c')).toBe(true);
    expect(allow('a')).toBe(true);
    expect(DEFAULT_MAX_RATE_LIMIT_CLIENTS).toBe(4096);
  });

  it('rejects unusable or unbounded rate-limit configuration at startup', () => {
    for (const options of [
      { limit: 0, windowMs: 1000 },
      { limit: 1, windowMs: 0 },
      { limit: 1, windowMs: 1, maxClients: 0 },
      { limit: Number.POSITIVE_INFINITY, windowMs: 1 },
      { limit: 1.5, windowMs: 1 },
    ]) expect(() => createRateLimiter(options)).toThrow(RangeError);
  });

  it('reclaims capacity at staggered client expirations without an extra full window', () => {
    let t = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 1000, maxClients: 2, now: () => t });
    expect([allow('a'), allow('a'), allow('a')]).toEqual([true, true, false]);
    t = 500;
    expect(allow('b')).toBe(true);
    expect(allow('c')).toBe(false);
    t = 1000;
    expect(allow('c')).toBe(true);
    expect(allow('b')).toBe(true);
    t = 1500;
    expect(allow('d')).toBe(true);
    expect(allow('b')).toBe(false);
  });
});
