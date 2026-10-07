import { describe, expect, it } from 'vitest';
import { Instrument } from '../types';
import { buildConnections, getLoopRole, groupLoops } from './topologyLayout';

const inst = (tagName: string, overrides: Partial<Instrument> = {}): Instrument => ({
  id: tagName,
  tagName,
  equipmentType: '',
  signalType: 'AI',
  description: '',
  engineeringUnits: '',
  pcs7BlockType: 'MonAnL',
  abb800xaObject: '',
  confidence: 'high',
  ...overrides,
});

const pairs = (instruments: Instrument[]) =>
  buildConnections(groupLoops(instruments)).map(c => `${c.source.tagName}>${c.target.tagName}`);

describe('getLoopRole', () => {
  it('classifies measurements, controllers and final elements', () => {
    expect(getLoopRole(inst('FT-101'))).toBe('sensor');
    expect(getLoopRole(inst('FIC-101', { pcs7BlockType: 'PIDConL' }))).toBe('controller');
    expect(getLoopRole(inst('TC-5', { pcs7BlockType: 'Unknown' }))).toBe('controller');
    expect(getLoopRole(inst('FCV-101', { signalType: 'AO', pcs7BlockType: 'VlvAnL' }))).toBe('actuator');
    expect(getLoopRole(inst('P-100', { signalType: 'DO', pcs7BlockType: 'MotL' }))).toBe('actuator');
  });
});

describe('groupLoops', () => {
  it('orders each loop sensor -> controller -> actuator regardless of model order', () => {
    const groups = groupLoops([
      inst('FCV-101', { signalType: 'AO', pcs7BlockType: 'VlvAnL' }),
      inst('FIC-101', { pcs7BlockType: 'PIDConL' }),
      inst('FT-101'),
      inst('TT-200'),
    ]);
    expect(groups.map(g => [g.loopId, g.items.map(i => i.tagName)])).toEqual([
      ['F-101', ['FT-101', 'FIC-101', 'FCV-101']],
      ['T-200', ['TT-200']],
    ]);
  });

  it('collects unparseable tags under Misc', () => {
    expect(groupLoops([inst('PUMP')])[0].loopId).toBe('Misc');
  });
});

describe('buildConnections', () => {
  it('chains a loop in role order when the model gave no links', () => {
    expect(pairs([
      inst('FCV-101', { signalType: 'AO', pcs7BlockType: 'VlvAnL' }),
      inst('FT-101'),
      inst('FIC-101', { pcs7BlockType: 'PIDConL' }),
    ])).toEqual(['FT-101>FIC-101', 'FIC-101>FCV-101']);
  });

  it('keeps the loop chain when the model links only part of it, and adds cross-loop links', () => {
    expect(pairs([
      inst('FT-101', { connectedTo: 'fic-101' }),
      inst('FIC-101', { pcs7BlockType: 'PIDConL' }),
      inst('FCV-101', { signalType: 'AO', pcs7BlockType: 'VlvAnL' }),
      inst('LT-300', { connectedTo: 'FCV-101' }),
    ])).toEqual(['FT-101>FIC-101', 'FIC-101>FCV-101', 'LT-300>FCV-101']);
  });

  it('draws one line per pair even when the model links both ways', () => {
    expect(pairs([
      inst('PT-1', { connectedTo: 'PV-1' }),
      inst('PV-1', { signalType: 'AO', pcs7BlockType: 'VlvAnL', connectedTo: 'PT-1' }),
    ])).toEqual(['PT-1>PV-1']);
  });

  it('ignores links to unknown tags and self links, and does not chain Misc', () => {
    expect(pairs([
      inst('PT-1', { connectedTo: 'NOPE-9' }),
      inst('PI-1', { connectedTo: 'PI-1' }),
      inst('PUMP'),
      inst('MIXER'),
    ])).toEqual(['PT-1>PI-1']);
  });
});
