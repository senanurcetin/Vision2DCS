export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Maximum distinct client identities retained in a single process. */
  maxClients?: number;
  now?: () => number;
}

export const DEFAULT_MAX_RATE_LIMIT_CLIENTS = 4096;

export const pruneExpiredRateLimitWindows = (
  windows: Map<string, { start: number }>,
  now: number,
  windowMs: number,
): void => {
  windows.forEach(({ start }, key) => {
    if (now - start >= windowMs) windows.delete(key);
  });
};

/**
 * Fixed-window, in-memory limiter keyed by client. Protects both the model
 * request budget and the process against unbounded distinct-client entries.
 * Once at capacity, new clients fail closed until an old window expires;
 * existing tracked clients can still use their remaining allowance.
 * Multi-instance deployments still require a shared upstream limiter.
 */
export const createRateLimiter = ({
  limit, windowMs, maxClients = DEFAULT_MAX_RATE_LIMIT_CLIENTS, now = Date.now,
}: RateLimiterOptions) => {
  if (![limit, windowMs, maxClients].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new RangeError('Rate limiter limits, window and maximum clients must be positive safe integers.');
  }
  const windows = new Map<string, { start: number; count: number }>();
  let nextCleanupAt = 0;

  return (key: string): boolean => {
    const t = now();
    if (t >= nextCleanupAt) {
      pruneExpiredRateLimitWindows(windows, t, windowMs);
      nextCleanupAt = t + windowMs;
    }
    const current = windows.get(key);
    if (!current) {
      if (windows.size >= maxClients) return false;
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (t - current.start >= windowMs) {
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count++;
    return true;
  };
};
