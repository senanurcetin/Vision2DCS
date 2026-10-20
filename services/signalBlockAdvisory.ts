import type { Instrument, PCS7BlockType, SignalType, SentinelAlert } from '../types';

/**
 * Heuristic *conceptual* I/O compatibility. It is not a Siemens PCS 7
 * engineering schema, proof of an actual module, or IEC safety certification.
 * Never auto-change the engineer's chosen signal or block classification.
 */
const expected: Partial<Record<PCS7BlockType, readonly SignalType[]>> = {
  MonAnL: ['AI'],
  MonDiL: ['DI'],
  MotL: ['DO'],
  VlvL: ['DO'],
  VlvAnL: ['AO'],
  PIDConL: ['AI', 'AO'],
};

export const inspectSignalBlockMappings = (
  instruments: ReadonlyArray<Instrument>,
): SentinelAlert[] => instruments.flatMap(instrument => {
  const allowable = expected[instrument.pcs7BlockType];
  if (!allowable || instrument.signalType === 'Unknown' ||
      allowable.includes(instrument.signalType)) return [];
  return [{
    tag: instrument.tagName,
    severity: 'warning' as const,
    message: 'Conceptual I/O mismatch: ' + instrument.pcs7BlockType +
      ' usually maps to ' + allowable.join('/') + ', but ' + instrument.signalType +
      ' is selected. Verify signal and function against approved engineering drawings; vendor semantics are unverified.',
  }];
});
