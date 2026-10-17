import { describe, expect, it } from 'vitest';
import type { Instrument } from '../types';
import { applyInstrumentUpdate } from './reviewState';

const instrument: Instrument = {
  id: 'p1', tagName: 'PT-101', equipmentType: 'Transmitter',
  signalType: 'AI', description: 'Pressure', engineeringUnits: 'barg',
  pcs7BlockType: 'MonAnL', abb800xaObject: 'AI_Object',
  confidence: 'high', reviewed: false,
};

describe('applyInstrumentUpdate', () => {
  it('records only an explicit review-toggle action as approval', () => {
    const output = applyInstrumentUpdate(instrument, { reviewed: true });
    expect(output.reviewed).toBe(true);
    expect(output.tagName).toBe('PT-101');
    expect(instrument.reviewed).toBe(false);
  });

  it('revokes approval after an engineering value changes', () => {
    const reviewed = applyInstrumentUpdate(instrument, { reviewed: true });
    for (const update of [
      { tagName: 'PT-102' },
      { description: 'Pressure transmitter revised' },
      { signalType: 'DI' as const },
      { pcs7BlockType: 'MonDiL' as const },
      { engineeringUnits: 'kPa' },
    ]) {
      expect(applyInstrumentUpdate(reviewed, update).reviewed).toBe(false);
    }
  });

  it('does not allow an engineering edit and review flag in the same update to bypass the gate', () => {
    const result = applyInstrumentUpdate(instrument, { tagName: 'PT-999', reviewed: true });
    expect(result.reviewed).toBe(false);
  });
});
