import { describe, expect, it } from 'vitest';
import type { Instrument } from '../types';
import { conceptExportBlockers } from './conceptExportGate';

const inst = (overrides: Partial<Instrument> = {}): Instrument => ({
  id: 'inst-1',
  tagName: 'PT-101',
  equipmentType: 'Transmitter',
  signalType: 'AI',
  description: 'Pressure measurement',
  engineeringUnits: 'barg',
  pcs7BlockType: 'MonAnL',
  abb800xaObject: 'AI_Object',
  confidence: 'high',
  reviewed: true,
  ...overrides,
});

describe('conceptExportBlockers', () => {
  it('rejects empty projects and invalid ISA tag names', () => {
    expect(conceptExportBlockers([])).toHaveLength(1);
    expect(conceptExportBlockers([inst({ tagName: 'BADTAG' })]).join(' '))
      .toMatch(/Non-standard ISA-5.1 naming/);
  });

  it('rejects duplicate canonical identities and unresolved classifications', () => {
    const reasons = conceptExportBlockers([
      inst({ id: 'one', tagName: 'PT-101' }),
      inst({ id: 'two', tagName: 'pt101', signalType: 'Unknown', pcs7BlockType: 'Unknown' }),
    ]);
    expect(reasons.join(' ')).toMatch(/Duplicate instrument tag PT-101/);
    expect(reasons.join(' ')).toMatch(/Assign a known signal/);
  });

  it('allows concept export only when no known critical tag or classification errors remain', () => {
    const reasons = conceptExportBlockers([
      inst({ tagName: 'FT-101', engineeringUnits: 'm3/h' }),
      inst({ id: 'valve', tagName: 'FCV-101', signalType: 'AO', pcs7BlockType: 'VlvAnL', engineeringUnits: '%' }),
    ]);
    expect(reasons).toEqual([]);
  });

  it('blocks malformed or cyclic explicit signal references even for reviewed rows', () => {
    expect(conceptExportBlockers([
      inst({ tagName: 'FT-101', connectedTo: 'NOT-999' }),
    ]).join(' ')).toMatch(/does not exist/);
    expect(conceptExportBlockers([
      inst({ id: 'ft', tagName: 'FT-101', connectedTo: 'FIC-101' }),
      inst({ id: 'fic', tagName: 'FIC-101', connectedTo: 'FT-101' }),
    ]).join(' ')).toMatch(/Directed signal cycle/);
    expect(conceptExportBlockers([
      inst({ id: 'ft', tagName: 'FT-101', connectedTo: 'FIC-101' }),
      inst({ id: 'fic', tagName: 'FIC-101', connectedTo: undefined }),
    ])).toEqual([]);
  });

  it('does not accept model confidence or untrusted review flags as engineering approval', () => {
    const unreviewed = inst({ reviewed: false, confidence: 'high' });
    expect(conceptExportBlockers([unreviewed]).join(' ')).toMatch(/Explicit human review/);
    expect(conceptExportBlockers([inst({ reviewed: undefined })]).join(' ')).toMatch(/Explicit human review/);
    expect(conceptExportBlockers([inst({ reviewed: true })])).toEqual([]);
  });

  it('does not confuse warnings with certification, and does not mutate inputs', () => {
    const original = inst({ engineeringUnits: '' });
    const before = structuredClone(original);
    expect(conceptExportBlockers([original])).toEqual([]);
    expect(original).toEqual(before);
  });
});
