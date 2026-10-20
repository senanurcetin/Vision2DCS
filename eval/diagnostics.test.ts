import { describe, expect, it } from 'vitest';
import { diagnoseBenchmarkReport } from './diagnostics';
import {
  buildBenchmarkReport, buildTopologyBenchmarkReport,
  type BenchmarkSample, type BenchmarkTopologySample,
} from './report';

const time = '2026-10-21T00:00:00.000Z';
const sample = (name: string, expected: number, extracted: number, matched: number): BenchmarkSample => ({
  name,
  drawingSha256: (name === 'large' ? 'a' : 'b').repeat(64),
  expectedSha256: (name === 'large' ? 'c' : 'd').repeat(64),
  score: {
    expected, extracted, matched,
    signalCorrect: matched, blockCorrect: matched,
    missed: Array.from({ length: expected - matched }, (_, i) => 'PT-' + String(200 + i)),
    unexpected: Array.from({ length: extracted - matched }, (_, i) => 'XX-' + String(200 + i)),
  },
});

const topology = (
  base: BenchmarkSample, expected: number, extracted: number, matched: number,
): BenchmarkTopologySample => ({
  ...base,
  topologyScore: {
    expected, extracted, matched,
    missed: Array.from({ length: expected - matched }, (_, i) => 'PT-' + i + ' -> FIC-' + i),
    unexpected: Array.from({ length: extracted - matched }, (_, i) => 'XV-' + i + ' -> FT-' + i),
  },
});

describe('offline per-drawing scientific diagnostics', () => {
  it('reveals poor small-drawing performance masked by a high micro-average', () => {
    const report = buildTopologyBenchmarkReport('not-provider-verified', [
      topology(sample('large', 10, 10, 10), 3, 3, 3),
      topology(sample('small', 1, 1, 0), 0, 0, 0),
    ], time);
    const result = diagnoseBenchmarkReport(report);
    expect(result.kind).toBe('unverified-historical-report-diagnostics');
    expect(result.micro.f1).toBeCloseTo(10 / 11);
    expect(result.macroTags.f1.mean).toBe(0.5);
    expect(result.macroTags.f1.evaluatedDrawings).toBe(2);
    expect(result.weakestTagDrawing).toBe('small');
    expect(result.drawings.map(d => d.name)).toEqual(['large', 'small']);
    expect(result.drawings[0].drawingSha256).toBe('a'.repeat(64));
    expect(result.macroTopology?.f1).toEqual({ mean: 1, evaluatedDrawings: 1 });
    expect(result.drawings[1].topology?.metrics.f1).toBeNull();
    expect(result.weakestTopologyDrawing).toBe('large');
  });

  it('assigns zero F1 to a complete missed topology but null to a truly empty topology', () => {
    const report = buildTopologyBenchmarkReport('offline-example', [
      topology(sample('large', 1, 1, 1), 2, 0, 0),
      topology(sample('small', 1, 1, 1), 0, 0, 0),
    ], time);
    const result = diagnoseBenchmarkReport(report);
    expect(result.drawings[0].topology?.metrics).toEqual({ precision: null, recall: 0, f1: 0 });
    expect(result.drawings[1].topology?.metrics.f1).toBeNull();
    expect(result.macroTopology?.f1).toEqual({ mean: 0, evaluatedDrawings: 1 });
    expect(result.macroTopology?.precision).toEqual({ mean: null, evaluatedDrawings: 0 });
    expect(result.weakestTopologyDrawing).toBe('large');
  });

  it('supports historical tag-only v1 records and reports zero denominator coverage', () => {
    const report = buildBenchmarkReport('historical', [sample('small', 0, 0, 0)], time);
    const result = diagnoseBenchmarkReport(report);
    expect(result.schemaVersion).toBe(1);
    expect(result.macroTags.f1).toEqual({ mean: null, evaluatedDrawings: 0 });
    expect(result.macroTags.signalAccuracy.evaluatedDrawings).toBe(0);
    expect(result.weakestTagDrawing).toBeNull();
    expect(result.macroTopology).toBeUndefined();
    expect(result.microTopology).toBeUndefined();
  });

  it('rejects forged reports before producing any research summary', () => {
    const original = buildBenchmarkReport('example', [sample('large', 2, 2, 1)], time);
    expect(() => diagnoseBenchmarkReport({
      ...original, summary: { ...original.summary, f1: 1 },
    })).toThrow(/summary does not match/);
    expect(() => diagnoseBenchmarkReport({
      ...original, samples: [{ ...original.samples[0], drawingSha256: 'unknown' }],
    })).toThrow(/untraceable/);
  });
});
