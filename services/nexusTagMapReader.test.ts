import { describe, expect, it } from 'vitest';
import type { AnalysisProject, Instrument } from '../types';
import { buildReviewedTagMap } from './nexusTagMap';
import { parseNexusTagMapV1, serializeNexusTagMapV1, validateNexusTagMapV1, MAX_NEXUS_TAG_MAP_BYTES } from './nexusTagMapReader';

const sensor = (tagName: string): Instrument => ({
  id: tagName, tagName, equipmentType: 'Transmitter', signalType: 'AI', description: 'Feed measurement',
  engineeringUnits: 'bar', pcs7BlockType: 'MonAnL', abb800xaObject: 'Signal_Object',
  confidence: 'high', reviewed: true,
});
const source: AnalysisProject = {
  id: 'p-01', name: 'Offline synthetic process', date: '2026-10-19',
  imageUrl: 'data:image/png;base64,AAAA',
  instruments: [sensor('PT-101'), sensor('TT-102')],
};
const generated = () => buildReviewedTagMap(source, '2026-10-19T10:00:00.000Z');

describe('read-only NEXUS Tag Map v1 input boundary', () => {
  it('accepts the independently generated, source-hashed-free offline export', () => {
    const generatedMap = generated();
    const parsed = parseNexusTagMapV1(serializeNexusTagMapV1(generatedMap));
    expect(parsed).toEqual(generatedMap);
    expect(parsed.tags.map(row => row.tag)).toEqual(['PT-101', 'TT-102']);
    expect(JSON.stringify(parsed)).not.toContain('imageUrl');
  });

  it('enforces the actual pretty-printed download size, not only compact JSON bytes', () => {
    const many: AnalysisProject = {
      ...source,
      instruments: Array.from({ length: 1900 }, (_, i) => ({
        ...sensor('PT-' + String(10000 + i)),
        description: 'A'.repeat(400),
      })),
    };
    const map = buildReviewedTagMap(many, '2026-10-19T10:00:00.000Z');
    expect(new TextEncoder().encode(JSON.stringify(map)).byteLength).toBeLessThan(MAX_NEXUS_TAG_MAP_BYTES);
    expect(() => serializeNexusTagMapV1(map)).toThrow('Formatted NEXUS Tag Map v1 exceeds');
    const standard = serializeNexusTagMapV1(generated());
    expect(standard.endsWith('\n')).toBe(true);
    expect(new TextEncoder().encode(standard).byteLength).toBeLessThanOrEqual(MAX_NEXUS_TAG_MAP_BYTES);
    expect(parseNexusTagMapV1(standard)).toEqual(generated());
  });

  it('refuses forged schema, mode, origin and unsupported fields', () => {
    const base = generated();
    for (const invalid of [
      { ...base, version: 2 },
      { ...base, mode: 'control-write' },
      { ...base, evidence: 'certified-operator' },
      { ...base, secretToken: 'should-never-import' },
      { ...base, generatedAt: '2026-02-30T10:00:00.000Z' },
      { ...base, source: { ...base.source, product: 'Other-Plant' } },
      { ...base, source: { ...base.source, projectId: '../../other' } },
      { ...base, source: { ...base.source, connectionString: 'private-plant' } },
    ]) {
      expect(() => validateNexusTagMapV1(invalid)).toThrow();
    }
  });

  it('rejects duplicate, malformed or potentially executable tag content', () => {
    const base = generated();
    for (const rows of [
      [base.tags[0], base.tags[0]],
      [{ ...base.tags[0], tag: 'pt101' }],
      [{ ...base.tags[0], tag: '=DANGEROUS' }],
      [{ ...base.tags[0], pcs7BlockType: 'Unknown' }],
      [{ ...base.tags[0], signalType: 'HART' }],
      [{ ...base.tags[0], description: 'PLC\u202Eoverride' }],
      [{ ...base.tags[0], engineeringUnits: 'unit\u0000' }],
      [{ ...base.tags[0], extra: 'injection' }],
      [],
    ]) {
      expect(() => validateNexusTagMapV1({ ...base, tags: rows })).toThrow();
    }
  });

  it('never accepts more than 2000 tags or a payload above one MiB', () => {
    const base = generated();
    expect(() => validateNexusTagMapV1({ ...base, tags: Array(2001).fill(base.tags[0]) })).toThrow();
    expect(() => parseNexusTagMapV1(' '.repeat(MAX_NEXUS_TAG_MAP_BYTES + 1))).toThrow('1 MiB');
  });

  it('returns JSON errors rather than accepting partial or non-object sources', () => {
    expect(() => parseNexusTagMapV1('{broken')).toThrow('not valid JSON');
    expect(() => parseNexusTagMapV1('null')).toThrow('envelope');
    expect(() => parseNexusTagMapV1('[]')).toThrow('envelope');
    expect(() => parseNexusTagMapV1(JSON.stringify({ schema: 'unknown' }))).toThrow('envelope');
  });
});
