import { describe, expect, it } from 'vitest';
import { Instrument } from '../types';
import { runSentinelAudit } from './otSentinelService';

const inst = (overrides: Partial<Instrument>): Instrument => ({
  id: overrides.tagName ?? 'id',
  tagName: 'PT-101',
  equipmentType: 'Transmitter',
  signalType: 'AI',
  description: 'Pressure measurement',
  engineeringUnits: 'barg',
  pcs7BlockType: 'MonAnL',
  abb800xaObject: 'AI_Object',
  confidence: 'high',
  ...overrides,
});

const messagesFor = (instruments: Instrument[], tag: string) =>
  runSentinelAudit(instruments).filter(a => a.tag === tag).map(a => a.message);

describe('runSentinelAudit', () => {
  it('raises nothing for a clean, complete flow loop', () => {
    const alerts = runSentinelAudit([
      inst({ tagName: 'FT-101', engineeringUnits: 'm3/h' }),
      inst({ tagName: 'FCV-101', signalType: 'AO', pcs7BlockType: 'VlvAnL', engineeringUnits: '%' }),
    ]);
    expect(alerts).toEqual([]);
  });

  it('flags non-ISA tag names as errors', () => {
    const alerts = runSentinelAudit([inst({ tagName: 'PRESSURE1' })]);
    expect(alerts).toEqual([expect.objectContaining({ tag: 'PRESSURE1', severity: 'error' })]);
  });

  it('asks for review of unclassified signal or block types', () => {
    expect(messagesFor([inst({ tagName: 'XY-10', signalType: 'Unknown' })], 'XY-10')[0]).toMatch(/could not be classified/);
    expect(messagesFor([inst({ tagName: 'XY-11', pcs7BlockType: 'Unknown' })], 'XY-11')[0]).toMatch(/could not be classified/);
  });

  it('warns about analog signals without engineering units', () => {
    expect(messagesFor([inst({ engineeringUnits: ' ' })], 'PT-101')[0]).toMatch(/no engineering units/);
    expect(messagesFor([inst({ tagName: 'XS-10', signalType: 'DI', pcs7BlockType: 'MonDiL', engineeringUnits: '' })], 'XS-10')).toEqual([]);
  });

  it('flags safety-related descriptions', () => {
    expect(messagesFor([inst({ description: 'Emergency shutdown pressure' })], 'PT-101')[0]).toMatch(/IEC 61511/);
  });

  it('reports a flow transmitter without a control valve in its loop', () => {
    const alerts = runSentinelAudit([inst({ tagName: 'FT-200', engineeringUnits: 'm3/h' })]);
    expect(alerts).toEqual([expect.objectContaining({ tag: 'Loop F-200', severity: 'info' })]);
  });

  it('does not count a valve from another variable with the same number', () => {
    const alerts = runSentinelAudit([
      inst({ tagName: 'FT-300', engineeringUnits: 'm3/h' }),
      inst({ tagName: 'PCV-300', signalType: 'AO', pcs7BlockType: 'VlvAnL', engineeringUnits: '%' }),
    ]);
    expect(alerts.map(a => a.tag)).toEqual(['Loop F-300']);
  });

  it('does not treat a tag that merely contains V as a valve', () => {
    const alerts = runSentinelAudit([
      inst({ tagName: 'FT-400', engineeringUnits: 'm3/h' }),
      inst({ tagName: 'FS-400V', signalType: 'DI', pcs7BlockType: 'MonDiL', engineeringUnits: '' }),
    ]);
    expect(alerts.map(a => a.tag)).toEqual(['Loop F-400']);
  });
});
