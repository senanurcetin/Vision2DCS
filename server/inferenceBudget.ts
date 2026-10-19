/** A conservative per-process *app invocation* cap, not a cloud billing cap. */
export const MAX_AI_REQUEST_CAP = 1000;

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
