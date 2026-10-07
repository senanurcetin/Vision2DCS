const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Rate limits and transient upstream failures are worth retrying; bad requests are not. */
export const isRetryable = (error: unknown): boolean => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' && RETRYABLE_STATUS.has(status);
};

/** Runs fn, retrying retryable failures with exponential backoff (base, 2x base, ...). */
export const withRetry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const { attempts = 3, baseDelayMs = 500, sleep = defaultSleep } = options;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
};
