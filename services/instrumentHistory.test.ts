import { describe, expect, it } from 'vitest';
import type { Instrument } from '../types';
import {
  emptyInstrumentHistory, MAX_UNDO_STEPS, recordInstrumentEdit,
  undoInstrumentEdit, redoInstrumentEdit,
} from './instrumentHistory';

const row = (tagName: string, reviewed = false): Instrument => ({
  id: tagName, tagName, equipmentType: 'Transmitter', signalType: 'AI',
  description: 'Measurement', engineeringUnits: 'barg',
  pcs7BlockType: 'MonAnL', abb800xaObject: 'AI_Object',
  confidence: 'high', reviewed,
});

describe('instrument edit undo/redo', () => {
  it('restores changed rows while revoking previous local review', () => {
    const old = [row('PT-101', true)];
    const edited = [row('PT-102', false)];
    const history = recordInstrumentEdit(emptyInstrumentHistory(), old);
    const undone = undoInstrumentEdit(history, edited)!;
    expect(undone.instruments).toEqual([row('PT-101', false)]);
    expect(old[0].reviewed).toBe(true);
    const redone = redoInstrumentEdit(undone.history, undone.instruments)!;
    expect(redone.instruments).toEqual(edited);
    expect(redone.history.future).toEqual([]);
  });

  it('makes a new edit clear redo history and never crosses the bounded snapshot limit', () => {
    let history = emptyInstrumentHistory();
    for (let i = 0; i < MAX_UNDO_STEPS + 10; i++) {
      history = recordInstrumentEdit(history, [row('PT-' + i)]);
    }
    expect(history.past).toHaveLength(MAX_UNDO_STEPS);
    expect(history.past[0][0].tagName).toBe('PT-10');
    const undone = undoInstrumentEdit(history, [row('PT-999')])!;
    expect(undone.history.future).toHaveLength(1);
    const branched = recordInstrumentEdit(undone.history, undone.instruments);
    expect(branched.future).toHaveLength(0);
    expect(redoInstrumentEdit(branched, undone.instruments)).toBeNull();
  });

  it('does not mutate row arrays or fabricate a transition with no history', () => {
    const current = [row('PT-101', true)];
    const empty = emptyInstrumentHistory();
    expect(undoInstrumentEdit(empty, current)).toBeNull();
    expect(redoInstrumentEdit(empty, current)).toBeNull();
    const history = recordInstrumentEdit(empty, current);
    expect(history.past[0]).toBe(current);
    expect(undoInstrumentEdit(history, [row('PT-102')])!.instruments[0]).not.toBe(current[0]);
    expect(current[0].reviewed).toBe(true);
  });
});
