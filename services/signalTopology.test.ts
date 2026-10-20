import { describe, expect, it } from 'vitest';
import type { Instrument } from '../types';
import { analyzeSignalTopology } from './signalTopology';

const inst = (tagName: string, connectedTo?: string, id = tagName): Instrument => ({
  id, tagName, connectedTo, equipmentType: 'Transmitter', signalType: 'AI',
  description: 'Synthetic instrument', engineeringUnits: 'bar',
  pcs7BlockType: 'MonAnL', abb800xaObject: 'AI_Object',
  confidence: 'low', reviewed: false,
});
const messages = (rows: Instrument[]) => analyzeSignalTopology(rows).issues.map(i => i.message).join('; ');

describe('explicit directed signal topology guard', () => {

  it('never displays an explicit HMI edge from an ambiguous or invalid source tag', () => {
    const duplicateSources = [
      inst('FT-101', 'FIC-101', 'first'), inst('ft101', undefined, 'second'),
      inst('FIC-101'), inst('PT-201', 'FIC-101'),
    ];
    const result = analyzeSignalTopology(duplicateSources);
    expect(result.edges.map(edge => edge.sourceTag + '>' + edge.targetTag))
      .toEqual(['PT-201>FIC-101']);
    expect(result.issues.some(issue => issue.message.includes('Ambiguous or invalid directed signal source')))
      .toBe(true);
    const invalidSource = analyzeSignalTopology([inst('bad/source', 'FIC-101'), inst('FIC-101')]);
    expect(invalidSource.edges).toEqual([]);
    expect(invalidSource.issues[0].severity).toBe('error');
  });

  it('fails closed when repeated internal IDs make source or target links ambiguous', () => {
    const rows = [
      inst('FT-101', 'FIC-101', 'repeated-id'),
      inst('FIC-101', undefined, 'repeated-id'),
      inst('PT-201', 'FIC-101'),
    ];
    const snapshot = structuredClone(rows);
    const result = analyzeSignalTopology(rows);
    expect(result.edges).toEqual([]);
    expect(result.issues.some(issue => issue.message.includes('share one internal ID'))).toBe(true);
    expect(result.issues.some(issue => issue.message.includes('duplicate internal row ID'))).toBe(true);
    expect(rows).toEqual(snapshot);

    // Duplicate IDs must remain an engineering error even when no explicit
    // connection is declared; resolving source identity precedes link review.
    const noEdges = analyzeSignalTopology([inst('TT-201', undefined, 'dup'), inst('LT-201', undefined, 'dup')]);
    expect(noEdges.issues.some(issue => issue.severity === 'error')).toBe(true);
  });

  it('resolves canonical aliases and cross-loop links in the original direction', () => {
    const data = [inst('FT-101', 'fic101'), inst('FIC-101', 'pt102'), inst('PT-102')];
    const result = analyzeSignalTopology(data);
    expect(result.issues).toEqual([]);
    expect(result.edges.map(x => x.sourceTag + '>' + x.targetTag))
      .toEqual(['FT-101>FIC-101', 'FIC-101>PT-102']);
    expect(data[0].connectedTo).toBe('fic101'); // pure analysis
  });

  it('treats absent outgoing links as unannotated, never infers a connection', () => {
    expect(analyzeSignalTopology([inst('FT-101'), inst('FIC-101')]))
      .toEqual({ edges: [], issues: [] });
  });

  it('reports dangling, malformed, oversized, self and ambiguous references', () => {
    expect(messages([inst('PT-101', 'ZZ-999')])).toMatch(/does not exist/);
    expect(messages([inst('PT-101', 'not/valid')])).toMatch(/Invalid directed signal target/);
    expect(messages([inst('PT-101', 'x'.repeat(200))])).toMatch(/Invalid directed signal target/);
    expect(messages([inst('PT-101', 'pt101')])).toMatch(/cannot connect an instrument to itself/);
    expect(messages([
      inst('FT-101', 'TT-201'), inst('TT-201', undefined, 'one'),
      inst('tt201', undefined, 'two'),
    ])).toMatch(/ambiguous/);
  });

  it('detects directed cycles without confusing an acyclic long chain', () => {
    const cycle = [inst('FT-101', 'FIC-101'), inst('FIC-101', 'FCV-101'), inst('FCV-101', 'FT-101')];
    expect(messages(cycle)).toMatch(/Directed signal cycle: .*FT-101.*FIC-101.*FCV-101/);
    expect(messages([inst('FT-101', 'FIC-101'), inst('FIC-101', 'FCV-101'), inst('FCV-101')]))
      .toBe('');
  });

  it('walks long graphs iteratively without recursion or quadratic rescanning', () => {
    const chain = Array.from({ length: 1200 }, (_, i) =>
      inst('PT-' + String(10000 + i), i < 1199 ? 'PT-' + String(10001 + i) : undefined));
    const result = analyzeSignalTopology(chain);
    expect(result.edges).toHaveLength(1199);
    expect(result.issues).toEqual([]);
  });
});
