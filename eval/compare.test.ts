import { describe, expect, it } from 'vitest';
import { buildBenchmarkReport, type BenchmarkSample } from './report';
import { compareBenchmarkReports, validateBenchmarkReport } from './compare';

const a = 'a'.repeat(64), b = 'b'.repeat(64);
function sample(name: string, matched: number): BenchmarkSample {
  return {
    name,
    drawingSha256: a,
    expectedSha256: b,
    score: {
      expected: 2,
      extracted: 2,
      matched,
      missed: matched === 1 ? ['TT-102'] : [],
      unexpected: matched === 1 ? ['PT-999'] : [],
      signalCorrect: matched,
      blockCorrect: matched,
    },
  };
}
function report(model: string, data: BenchmarkSample[]) {
  return buildBenchmarkReport(model, data, '2026-10-17T15:00:00.000Z');
}

describe('offline paired benchmark comparison', () => {
  it('compares true precision/recall/F1 deltas with source-matched samples', () => {
    const baseline = report('baseline', [sample('b-drawing', 1), sample('a-drawing', 1)]);
    const candidate = report('candidate', [sample('a-drawing', 2), sample('b-drawing', 2)]);
    const output = compareBenchmarkReports(baseline, candidate);
    expect(output.sampleCount).toBe(2);
    expect(output.baselineModel).toBe('baseline');
    expect(output.candidateModel).toBe('candidate');
    expect(output.baseline.f1).toBeCloseTo(0.5);
    expect(output.candidate.f1).toBeCloseTo(1);
    expect(output.delta.f1).toBeCloseTo(0.5);
    expect(output.delta.precision).toBeCloseTo(0.5);
    expect(output.delta.recall).toBeCloseTo(0.5);
  });

  it('rejects differing drawings, references or sample names instead of comparing incomparable scores', () => {
    const base = report('baseline', [sample('a-drawing', 1)]);
    const next = report('next', [sample('a-drawing', 2)]);
    expect(() => compareBenchmarkReports(base, {
      ...next, samples: [{ ...next.samples[0], drawingSha256: 'c'.repeat(64) }],
    })).toThrow('drawings or reference labels differ');
    expect(() => compareBenchmarkReports(base, {
      ...next, samples: [{ ...next.samples[0], expectedSha256: 'd'.repeat(64) }],
    })).toThrow('drawings or reference labels differ');
    expect(() => compareBenchmarkReports(base, report('next', [sample('new-drawing', 2)])))
      .toThrow('drawings or reference labels differ');
    expect(() => compareBenchmarkReports(base, report('next', [sample('a-drawing', 2), sample('b-drawing', 2)])))
      .toThrow('sample counts differ');
  });

  it('does not trust forged metrics or invalid per-sample counts in imported JSON', () => {
    const good = report('model', [sample('a-drawing', 1)]);
    expect(() => validateBenchmarkReport({ ...good, summary: { ...good.summary, f1: 1 } }))
      .toThrow('summary does not match');
    expect(() => validateBenchmarkReport({ ...good, samples: [{
      ...good.samples[0], score: { ...good.samples[0].score, matched: 3 },
    }] })).toThrow('sample scoring counts');
    expect(() => validateBenchmarkReport({ ...good, schemaVersion: 999 })).toThrow('unsupported');
    expect(() => validateBenchmarkReport({ ...good, generatedAt: '2026-02-30T15:00:00.000Z' }))
      .toThrow('unsupported');
  });

  it('rejects duplicates and tampered digests in untrusted reports', () => {
    const good = report('model', [sample('a-drawing', 1)]);
    expect(() => validateBenchmarkReport({
      ...good, sampleCount: 2, samples: [good.samples[0], good.samples[0]],
    })).toThrow('duplicated');
    expect(() => validateBenchmarkReport({
      ...good, samples: [{ ...good.samples[0], expectedSha256: 'not-a-hash' }],
    })).toThrow('untraceable');
  });
});
