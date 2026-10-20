import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { prepareBenchmarkSamples } from './preflight';
import { inspectBenchmarkCorpus } from './inspect';

describe('scientific dataset inventory, never fake AI performance', () => {
  it('reports independent drawings separately from instrument and edge counts', async () => {
    const samples = await prepareBenchmarkSamples(path.resolve('samples'));
    const overview = inspectBenchmarkCorpus(samples);
    expect(overview.kind).toBe('unscored-offline-fixture-inventory');
    expect(overview.drawingCount).toBe(samples.length);
    expect(overview.taggedInstruments).toBe(samples.reduce((n, s) => n + s.instruments.length, 0));
    expect(overview.directedSignalLinks)
      .toBe(samples.reduce((n, s) => n + s.signalConnections.length, 0));
    expect(overview.independentDrawingEvidence).toBe('insufficient');
    expect(JSON.stringify(overview)).not.toMatch(/"precision"|"recall"|"f1"|"accuracy"/);
    expect(overview.samples.every(row => row.drawingSha256.length === 64 && row.expectedSha256.length === 64))
      .toBe(true);
  });
  it('does not misrepresent multiple accepted reference types as independent instruments', () => {
    const example = {
      name: 'ambiguous-label', drawing: Buffer.from(''),
      drawingSha256: 'a'.repeat(64), expectedSha256: 'b'.repeat(64),
      instruments: [{ tagName: 'FIC-101', signalType: ['AI', 'AO'], pcs7BlockType: 'PIDConL' }],
      signalConnections: [{ source: 'FIC-101', target: 'FT-101' }],
    };
    const result = inspectBenchmarkCorpus([example]);
    expect(result.taggedInstruments).toBe(1);
    expect(result.ambiguousReferenceTypes).toBe(1);
    expect(result.signalClassCounts.AI).toBe(1);
    expect(result.signalClassCounts.AO).toBe(1);
    expect(result.drawingCount).toBe(1);
  });
});
