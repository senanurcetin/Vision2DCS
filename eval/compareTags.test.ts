import { describe, expect, it } from 'vitest';
import { buildBenchmarkReport, buildTopologyBenchmarkReport } from './report';
import { compareTagDetectionOnly } from './compareTags';
import { compareBenchmarkReports } from './compare';

const when = '2026-10-21T00:00:00.000Z';
const sample = (matched: number) => ({
  name: 'same-source', drawingSha256: 'a'.repeat(64), expectedSha256: 'b'.repeat(64),
  score: {
    expected: 2, extracted: 2, matched, signalCorrect: 0, blockCorrect: 0,
    missed: matched === 1 ? ['PT-101'] : [],
    unexpected: matched === 1 ? ['TT-999'] : [],
  },
});
const ocr = () => buildBenchmarkReport('actual-ocr-placeholder', [sample(1)], when);
const candidate = () => buildTopologyBenchmarkReport('actual-provider-placeholder', [
  { ...sample(2), topologyScore: { expected: 1, extracted: 0, matched: 0, missed: ['FT-101 -> FIC-101'], unexpected: [] } },
], when);

describe('tag-only paired OCR/model methodology', () => {
  it('permits cross schema only when the shared tag measures refer to the same source bytes', () => {
    const compared = compareTagDetectionOnly(ocr(), candidate());
    expect(compared.scope).toBe('tag-detection-only');
    expect(compared.drawingCount).toBe(1);
    expect(compared.delta.f1).toBeCloseTo(0.5);
    expect(compared.baseline.schemaVersion).toBe(1);
    expect(compared.candidate.schemaVersion).toBe(2);
    expect(JSON.stringify(compared)).not.toContain('topologySummary');
    expect(JSON.stringify(compared)).not.toContain('signalAccuracy');
    expect(() => compareBenchmarkReports(ocr(), candidate())).toThrow('schema versions differ');
  });

  it('fails closed on altered drawing/label hashes or forged summary values', () => {
    const actual = candidate();
    expect(() => compareTagDetectionOnly(ocr(), {
      ...actual, samples: [{ ...actual.samples[0], drawingSha256: 'c'.repeat(64) }],
    })).toThrow(/identical source/);
    expect(() => compareTagDetectionOnly({
      ...ocr(), samples: [{ ...ocr().samples[0], expectedSha256: 'd'.repeat(64) }],
    }, actual)).toThrow(/identical source/);
    expect(() => compareTagDetectionOnly(ocr(), {
      ...actual, summary: { ...actual.summary, f1: 0 },
    })).toThrow(/summary does not match/);
  });

  it('rejects missing drawings and supports same-schema tag-only baseline checks', () => {
    expect(compareTagDetectionOnly(ocr(), ocr()).delta.f1).toBe(0);
    expect(() => compareTagDetectionOnly(ocr(), buildBenchmarkReport('other', [
      { ...sample(1), name: 'other' },
    ], when))).toThrow(/identical source/);
  });
});
