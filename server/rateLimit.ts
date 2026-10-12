export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

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
 * Fixed-window, in-memory limiter keyed by client. Good enough for a single
 * process; a multi-instance deployment needs a shared store instead.
 */
export const createRateLimiter = ({ limit, windowMs, now = Date.now }: RateLimiterOptions) => {
  const windows = new Map<string, { start: number; count: number }>();
  let nextCleanupAt = 0;

  return (key: string): boolean => {
    const t = now();
    if (t >= nextCleanupAt) {
      pruneExpiredRateLimitWindows(windows, t, windowMs);
      nextCleanupAt = t + windowMs;
    }
    const current = windows.get(key);
    if (!current || t - current.start >= windowMs) {
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count++;
    return true;
  };
};
