import type { Instrument } from '../types';

/**
 * Any change to an engineering field invalidates prior local review.
 * Changing only the review toggle is an explicit user action. This does not
 * create a signed or certified engineering approval.
 */
export function applyInstrumentUpdate(instrument: Instrument, updates: Partial<Instrument>): Instrument {
  const changesEngineeringData = Object.keys(updates).some(key => key !== 'reviewed');
  return {
    ...instrument,
    ...updates,
    reviewed: changesEngineeringData ? false : updates.reviewed === true,
  };
}
