import { describe, expect, it } from 'vitest';
import type { AnalysisProject, Instrument } from '../types';
import { buildReviewedTagMap, NEXUS_TAG_MAP_SCHEMA } from './nexusTagMap';

const tag = (id: string, tagName: string, changes: Partial<Instrument> = {}): Instrument => ({
  id, tagName, equipmentType: 'Transmitter', signalType: 'AI',
  pcs7BlockType: 'MonAnL', abb800xaObject: 'AI_Object',
  description: 'Instrument concept', engineeringUnits: 'bar',
  confidence: 'high', reviewed: true,
  ...changes,
});
const project = (instruments: Instrument[]): AnalysisProject => ({
  id: 'p1', name: 'Pump diagram', date: '2026-10-17',
  imageUrl: 'data:image/png;base64,AAAA',
  digitalTwinUrl: 'data:image/png;base64,BBBB',
  instruments,
});

describe('NEXUS tag-map schema v1', () => {
  it('exports stable sorted reviewed rows without drawings, secrets, cost or model confidence', () => {
    const input = project([
      tag('2', 'TT-102', { brand: 'Private Supplier', estimatedCost: 1000000 }),
      tag('1', 'pt101', { description: 'Pressure', connectedTo: 'sensitive-host.example' }),
    ]);
    const snapshot = structuredClone(input);
    const result = buildReviewedTagMap(input, '2026-10-17T10:00:00.000Z');
    expect(result.schema).toBe(NEXUS_TAG_MAP_SCHEMA);
    expect(result.version).toBe(1);
    expect(result.mode).toBe('read-only');
    expect(result.evidence).toBe('local-human-reviewed-concept');
    expect(result.tags.map(t => t.tag)).toEqual(['PT-101', 'TT-102']);
    const serialized = JSON.stringify(result);
    for (const forbidden of ['imageUrl', 'digitalTwinUrl', 'Private Supplier', 'sensitive-host.example', 'estimatedCost', 'confidence']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(input).toEqual(snapshot);
  });

  it('refuses missing approval, forged classifications, invalid or duplicate tags', () => {
    for (const tags of [
      [tag('a', 'PT-101', { reviewed: false })],
      [tag('a', 'PT-101', { reviewed: undefined })],
      [tag('a', 'PT-101', { signalType: 'Unknown' })],
      [tag('a', 'INVALID/TAG')],
      [tag('a', 'PT-101'), tag('b', 'pt101')],
      [],
    ]) {
      expect(() => buildReviewedTagMap(project(tags), '2026-10-17T10:00:00.000Z')).toThrow();
    }
  });

  it('rejects malformed UTC stamps and project identity', () => {
    expect(() => buildReviewedTagMap(project([tag('a', 'PT-101')]), '2026-10-17')).toThrow('UTC ISO');
    expect(() => buildReviewedTagMap({ ...project([tag('a', 'PT-101')]), name: ' ' }, '2026-10-17T10:00:00.000Z')).toThrow('valid project ID');
    expect(() => buildReviewedTagMap(project([tag('a', 'PT-101')]), '2026-02-30T10:00:00.000Z')).toThrow('UTC ISO');
    for (const id of ['../tenant', 'a/b', '__/other', ' '.repeat(3), 'x'.repeat(129)]) {
      expect(() => buildReviewedTagMap({ ...project([tag('a', 'PT-101')]), id }, '2026-10-17T10:00:00.000Z')).toThrow();
    }
    for (const name of ['x'.repeat(501), 'Pump\u202EHidden']) {
      expect(() => buildReviewedTagMap({ ...project([tag('a', 'PT-101')]), name }, '2026-10-17T10:00:00.000Z')).toThrow();
    }

  });

  it('rejects receiver-incompatible control text, oversized units and descriptions', () => {
    const cases: Partial<Instrument>[] = [
      { description: 'PLC\u202Eoverride' },
      { engineeringUnits: 'foo\u0000bar' },
      { engineeringUnits: 'x'.repeat(101) },
      { description: 'x'.repeat(1001) },
    ];
    for (const item of cases) {
      expect(() => buildReviewedTagMap(project([tag('t', 'PT-101', item)]), '2026-10-17T10:00:00.000Z'))
        .toThrow('unsupported description or engineering unit');
    }
  });

  it('limits instrument counts and total serialized bytes to the receiving schema', () => {
    const timestamp = '2026-10-17T10:00:00.000Z';
    const large = Array.from({ length: 1200 }, (_, i) =>
      tag(String(i), 'PT-' + String(10000 + i), { description: 'A'.repeat(1000) }));
    expect(() => buildReviewedTagMap(project(large), timestamp)).toThrow('1 MiB');
    const tooMany = Array.from({ length: 2001 }, (_, i) =>
      tag(String(i), 'PT-' + String(10000 + i)));
    expect(() => buildReviewedTagMap(project(tooMany), timestamp)).toThrow('at most 2000');
  });
});
