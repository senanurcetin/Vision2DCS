import type { Instrument } from '../types';

export interface InstrumentHistory {
  past: Instrument[][];
  future: Instrument[][];
}

export const MAX_UNDO_STEPS = 30;
export const emptyInstrumentHistory = (): InstrumentHistory => ({ past: [], future: [] });

/** Record only engineering-list changes, keeping drawings out of undo memory. */
export const recordInstrumentEdit = (
  history: InstrumentHistory,
  before: Instrument[],
): InstrumentHistory => ({
  past: [...history.past, before].slice(-MAX_UNDO_STEPS),
  future: [],
});

export interface HistoryTransition {
  instruments: Instrument[];
  history: InstrumentHistory;
}

/**
 * Returning to an old row snapshot must not silently re-approve engineering
 * fields. A restored set requires explicit local review before concept export.
 * This is intentionally conservative: all restored rows lose review flags.
 */
const revokeRestoredReviews = (instruments: Instrument[]) =>
  instruments.map(instrument => ({ ...instrument, reviewed: false }));

export const undoInstrumentEdit = (
  history: InstrumentHistory,
  current: Instrument[],
): HistoryTransition | null => {
  const previous = history.past.at(-1);
  if (!previous) return null;
  return {
    instruments: revokeRestoredReviews(previous),
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, MAX_UNDO_STEPS),
    },
  };
};

export const redoInstrumentEdit = (
  history: InstrumentHistory,
  current: Instrument[],
): HistoryTransition | null => {
  const next = history.future[0];
  if (!next) return null;
  return {
    instruments: revokeRestoredReviews(next),
    history: {
      past: [...history.past, current].slice(-MAX_UNDO_STEPS),
      future: history.future.slice(1),
    },
  };
};
