export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

/**
 * Fixed-window, in-memory limiter keyed by client. Good enough for a single
 * process; a multi-instance deployment needs a shared store instead.
 */
export const createRateLimiter = ({ limit, windowMs, now = Date.now }: RateLimiterOptions) => {
  const windows = new Map<string, { start: number; count: number }>();

  return (key: string): boolean => {
    const t = now();
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
