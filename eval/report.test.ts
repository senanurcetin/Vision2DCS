import { describe, expect, it } from 'vitest';
import { BenchmarkSample, buildBenchmarkReport } from './report';

const sha = 'a'.repeat(64);
const sample = (name: string, matched: number, expected: number, extracted: number): BenchmarkSample => ({
  name,
  drawingSha256: sha,
  expectedSha256: 'b'.repeat(64),
  score: {
    expected,
    extracted,
    matched,
    missed: [],
    unexpected: [],
    signalCorrect: matched,
    blockCorrect: matched,
  },
});

describe('buildBenchmarkReport', () => {
  it('produces deterministic sample ordering and microaveraged metrics', () => {
    const input = [sample('z-drawing', 1, 2, 1), sample('a-drawing', 2, 2, 4)];
    const output = buildBenchmarkReport('gemini-evaluation-model', input, '2026-10-17T00:00:00.000Z');
    expect(output.schemaVersion).toBe(1);
    expect(output.scoring).toBe('canonical-tag-microaverage');
    expect(output.sampleCount).toBe(2);
    expect(output.samples.map(s => s.name)).toEqual(['a-drawing', 'z-drawing']);
    expect(output.summary.precision).toBeCloseTo(3 / 5);
    expect(output.summary.recall).toBeCloseTo(3 / 4);
    expect(input[0].name).toBe('z-drawing');
    expect(JSON.stringify(output)).not.toContain('GEMINI_API_KEY');
  });

  it('refuses missing, duplicate and untraceable source evidence', () => {
    const timestamp = '2026-10-17T00:00:00.000Z';
    expect(() => buildBenchmarkReport('model', [], timestamp)).toThrow('at least one sample');
    expect(() => buildBenchmarkReport('', [sample('a', 1, 1, 1)], timestamp)).toThrow('model');
    expect(() => buildBenchmarkReport('model', [sample('a', 1, 1, 1), sample('a', 1, 1, 1)], timestamp))
      .toThrow('Duplicate');
    expect(() => buildBenchmarkReport('model', [{ ...sample('a', 1, 1, 1), expectedSha256: 'broken' }], timestamp))
      .toThrow('SHA-256');
    expect(() => buildBenchmarkReport('model', [sample('a', 1, 1, 1)], 'not-a-date')).toThrow('timestamp');
  });
});
