import { describe, expect, it, vi } from 'vitest';
import { isRetryable, withRetry } from './retry';

const failure = (status?: number) => Object.assign(new Error('boom'), { status });

describe('isRetryable', () => {
  it('retries rate limits and transient server errors only', () => {
    expect([429, 500, 502, 503, 504].every(s => isRetryable(failure(s)))).toBe(true);
    expect(isRetryable(failure(400))).toBe(false);
    expect(isRetryable(failure())).toBe(false);
    expect(isRetryable('boom')).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns the first successful result with exponential backoff between attempts', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn()
      .mockRejectedValueOnce(failure(503))
      .mockRejectedValueOnce(failure(429))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 100, sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it('gives up after the last attempt', async () => {
    const fn = vi.fn().mockRejectedValue(failure(503));
    await expect(withRetry(fn, { attempts: 2, sleep: async () => {} })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry errors that will not change', async () => {
    const fn = vi.fn().mockRejectedValue(failure(400));
    await expect(withRetry(fn, { sleep: async () => {} })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
