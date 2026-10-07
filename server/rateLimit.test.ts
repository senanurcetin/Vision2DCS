import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

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
});
