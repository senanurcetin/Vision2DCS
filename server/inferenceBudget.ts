/** A conservative per-process *app invocation* cap, not a cloud billing cap. */
export const MAX_AI_REQUEST_CAP = 1000;
export const MAX_AI_CONCURRENT = 8;

/** Explicit 1-8 in-flight provider-operation cap, rejecting ambiguous config. */
export const parseAiConcurrency = (value: string | undefined): number | null => {
  if (!value || !/^[1-9]$/.test(value)) return null;
  const parsed = Number(value);
  return parsed <= MAX_AI_CONCURRENT ? parsed : null;
};

export const parseAiRequestCap = (value: string | undefined): number | null => {
  if (!value || !/^[1-9][0-9]{0,3}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= MAX_AI_REQUEST_CAP ? parsed : null;
};

/**
 * Reserve synchronously before calling Gemini. Reservations are intentionally
 * not refunded on provider failure: repeated retries must not bypass the cap.
 * A process restart, multiple replicas and provider-side SDK retries can exceed
 * this number of actual billable provider operations. Enforce provider quotas.
 */
export const createInferenceRequestCap = (maxRequests: number): (() => boolean) => {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > MAX_AI_REQUEST_CAP) {
    throw new RangeError('AI request cap must be a positive integer at most 1000.');
  }
  let reserved = 0;
  return () => {
    if (reserved >= maxRequests) return false;
    reserved += 1;
    return true;
  };
};

/**
 * Process-local semaphore. Acquisition is synchronous and release idempotent.
 * A busy slot returns null without consuming a provider-call reservation.
 */
export const createInferenceConcurrencyGate = (maximum: number): (() => (() => void) | null) => {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > MAX_AI_CONCURRENT) {
    throw new RangeError('AI concurrency limit must be between 1 and 8.');
  }
  let active = 0;
  return () => {
    if (active >= maximum) return null;
    active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active--;
    };
  };
};
