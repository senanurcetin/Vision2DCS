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
    expect(getLoopRole(inst('FIC-101', { pcs7BlockType: 'PIDConL', signalType: 'AO' }))).toBe('controller');
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
      inst('PT-101', { connectedTo: 'PV-101' }),
      inst('PV-101', { signalType: 'AO', pcs7BlockType: 'VlvAnL', connectedTo: 'PT-101' }),
    ])).toEqual(['PT-101>PV-101']);
  });

  it('keeps declared direction when it opposes a visual loop-order heuristic', () => {
    expect(pairs([
      inst('FT-101'),
      inst('FIC-101', { pcs7BlockType: 'PIDConL', signalType: 'AO', connectedTo: 'FT-101' }),
      inst('FCV-101', { pcs7BlockType: 'VlvAnL', signalType: 'AO' }),
    ])).toEqual(['FIC-101>FT-101', 'FIC-101>FCV-101']);
  });

  it('matches connectedTo references using canonical tag identity', () => {
    expect(pairs([
      inst('PT-105', { connectedTo: ' pv101a ' }),
      inst('PV-101A', { signalType: 'AO', pcs7BlockType: 'VlvAnL' }),
    ])).toEqual(['PT-105>PV-101A']);
  });

  it.each([
    { name: 'first', labels: ['FT101', 'FT-101'] },
    { name: 'reversed', labels: ['FT-101', 'FT101'] },
  ])('does not guess a connectedTo target when canonical tags collide ($name)', ({ labels }) => {
    const source = inst('PT-105', { id: 'source', connectedTo: 'ft 101' });
    const duplicates = labels.map((tagName, index) =>
      inst(tagName, { id: `flow-${index}` }));
    const unaffected = inst('PT-106', { id: 'other-source', connectedTo: ' pv101a ' });
    const unique = inst('PV-101A', {
      id: 'unique-target', signalType: 'AO', pcs7BlockType: 'VlvAnL',
    });

    const connections = buildConnections(groupLoops([source, ...duplicates, unaffected, unique]));
    // An implicit same-loop chain may still connect the duplicated records.
    // A cross-loop reference to the ambiguous identity must not pick either one.
    expect(connections.filter(c => c.source.id === source.id)).toEqual([]);
    // Ambiguity in one tag must not suppress unrelated valid references.
    expect(connections.some(c => c.source.id === unaffected.id && c.target.id === unique.id))
      .toBe(true);
  });

  it('never adds a cross-loop HMI line from raw ambiguous declared input', () => {
    const rows = [
      inst('FT-101', { id: 'flow-a', connectedTo: 'PT-201' }),
      inst('ft101', { id: 'flow-b' }),
      inst('PT-201', { id: 'pressure' }),
    ];
    // Same-loop heuristic can still show a dashed layout chain, but the
    // ambiguous cross-loop source must not be emitted as a declared link.
    expect(pairs(rows).some(pair => pair.endsWith('>PT-201'))).toBe(false);

    // A repeated internal row ID cannot create an independently declared
    // cross-loop edge, even with unique visible tag strings.
    expect(pairs([
      inst('LT-201', { id: 'duplicate', connectedTo: 'PT-301' }),
      inst('FT-101', { id: 'duplicate' }),
      inst('PT-301', { id: 'target' }),
    ])).toEqual([]);

    expect(pairs([inst('PT-1', { connectedTo: 'LT-201' }), inst('LT-201')]))
      .toEqual([]);
  });

  it('ignores links to unknown tags and self links, and does not chain Misc', () => {
    expect(pairs([
      inst('PT-101', { connectedTo: 'NOPE-9' }),
      inst('PI-101', { connectedTo: 'PI-101' }),
      inst('PUMP'),
      inst('MIXER'),
    ])).toEqual(['PT-101>PI-101']);
  });
});
