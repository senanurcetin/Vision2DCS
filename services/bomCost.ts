import type { Instrument } from '../types';

/** Illustrative equipment cost; neither a quote nor an approved budget. */
export const MAX_ESTIMATED_UNIT_COST_USD = 1_000_000_000;

export const estimatedUnitCost = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) &&
  value >= 0 && value <= MAX_ESTIMATED_UNIT_COST_USD ? value : undefined;

export const summarizeEstimatedBom = (rows: ReadonlyArray<Pick<Instrument, 'estimatedCost'>>) => {
  let total = 0;
  let estimatedCount = 0;
  for (const row of rows) {
    const cost = estimatedUnitCost(row.estimatedCost);
    if (cost === undefined) continue;
    total += cost;
    estimatedCount += 1;
  }
  const missingCount = rows.length - estimatedCount;
  return { total, estimatedCount, missingCount, isComplete: missingCount === 0 };
};
