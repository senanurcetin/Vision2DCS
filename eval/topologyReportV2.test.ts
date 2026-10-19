import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildBenchmarkReport, buildTopologyBenchmarkReport,
  type BenchmarkSample, type BenchmarkTopologySample,
} from './report';
import { compareBenchmarkReports, validateBenchmarkReport } from './compare';
import { saveBenchmarkReport } from './reportFiles';

const created = '2026-10-19T11:00:00.000Z';
const base = (matched: number): BenchmarkSample => ({
  name: 'drawn-flow-loop',
  drawingSha256: 'a'.repeat(64),
  expectedSha256: 'b'.repeat(64),
  score: {
    expected: 2, extracted: 2, matched,
    signalCorrect: matched, blockCorrect: matched,
    missed: matched === 1 ? ['FCV-101'] : [],
    unexpected: matched === 1 ? ['PT-999'] : [],
  },
});
const topology = (matched: number): BenchmarkTopologySample => ({
  ...base(matched),
  topologyScore: {
    expected: 2, extracted: 2, matched,
    missed: matched === 1 ? ['FIC-101 -> FCV-101'] : [],
    unexpected: matched === 1 ? ['FCV-101 -> FT-101'] : [],
  },
});
const v2 = (model: string, matched: number) =>
  buildTopologyBenchmarkReport(model, [topology(matched)], created);

describe('versioned, source-hashed engineering benchmark reports', () => {
  it('stores real per-sample directed-edge evidence separately from tag metrics', () => {
    const candidate = v2('offline-test-model', 1);
    expect(candidate.schemaVersion).toBe(2);
    expect(candidate.scoring).toBe('canonical-tags-and-directed-signals');
    expect(candidate.summary.f1).toBeCloseTo(0.5);
    expect(candidate.topologySummary.f1).toBeCloseTo(0.5);
    expect(candidate.samples[0].topologyScore).toMatchObject({
      expected: 2, extracted: 2, matched: 1,
    });
    expect(validateBenchmarkReport(candidate)).toEqual(candidate);
  });

  it('compares both metric families when two v2 reports share exact source revisions', () => {
    const result = compareBenchmarkReports(v2('before', 1), v2('after', 2));
    expect(result.sampleCount).toBe(1);
    expect(result.delta.f1).toBeCloseTo(0.5);
    expect(result.topology?.baseline.f1).toBeCloseTo(0.5);
    expect(result.topology?.candidate.f1).toBe(1);
    expect(result.topology?.delta.precision).toBeCloseTo(0.5);
  });

  it('supports historical v1/v1 comparisons but blocks v1/v2 mixing in both directions', () => {
    const legacy = buildBenchmarkReport('legacy', [base(1)], created);
    expect(validateBenchmarkReport(legacy).schemaVersion).toBe(1);
    expect(compareBenchmarkReports(legacy, legacy).topology).toBeUndefined();
    expect(() => compareBenchmarkReports(legacy, v2('new', 1))).toThrow('schema versions differ');
    expect(() => compareBenchmarkReports(v2('new', 1), legacy)).toThrow('schema versions differ');
  });

  it('rejects forged topology summaries, malformed counts, missing measurements and duplicate edges', () => {
    const good = v2('validated', 1);
    expect(() => validateBenchmarkReport({
      ...good, topologySummary: { ...good.topologySummary, f1: 1 },
    })).toThrow('topology summary does not match');
    expect(() => validateBenchmarkReport({
      ...good, samples: [{ ...good.samples[0], topologyScore: { ...good.samples[0].topologyScore, matched: 3 } }],
    })).toThrow('topology scoring counts');
    expect(() => validateBenchmarkReport({
      ...good, samples: [{ ...good.samples[0], topologyScore: undefined }],
    })).toThrow('topology scoring counts');
    expect(() => validateBenchmarkReport({
      ...good, samples: [{ ...good.samples[0], topologyScore: {
        ...good.samples[0].topologyScore, missed: ['X -> Y', 'X -> Y'],
      } }],
    })).toThrow('topology scoring counts');
    expect(() => buildTopologyBenchmarkReport('bad', [{
      ...base(1), topologyScore: undefined as never,
    }], created)).toThrow('topology score for every sample');
  });

  it('rejects changed drawing or label identity before calculating paired deltas', () => {
    const before = v2('old', 1);
    const after = v2('new', 2);
    expect(() => compareBenchmarkReports(before, {
      ...after, samples: [{ ...after.samples[0], drawingSha256: 'c'.repeat(64) }],
    })).toThrow('drawings or reference labels differ');
    expect(() => compareBenchmarkReports(before, {
      ...after, samples: [{ ...after.samples[0], expectedSha256: 'd'.repeat(64) }],
    })).toThrow('drawings or reference labels differ');
  });

  it('refuses topology metrics hidden inside legacy tag-only reports', () => {
    const legacy = buildBenchmarkReport('v1', [base(1)], created);
    expect(() => validateBenchmarkReport({
      ...legacy, samples: [{ ...legacy.samples[0], topologyScore: topology(1).topologyScore }],
    })).toThrow('Topology evidence');
  });
});

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('immutable benchmark v2 storage', () => {
  it('retains v1 history and atomically replaces latest with a valid v2 report', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vision-topology-v2-'));
    directories.push(dir);
    const old = await saveBenchmarkReport(dir, buildBenchmarkReport('old', [base(1)], created));
    const candidate = v2('new', 2);
    const next = await saveBenchmarkReport(dir, candidate);
    expect(JSON.parse(await readFile(next.latestFile, 'utf8')).topologySummary.f1).toBe(1);
    expect(JSON.parse(await readFile(old.historyFile, 'utf8')).schemaVersion).toBe(1);
    expect((await readdir(path.join(dir, 'runs')))).toHaveLength(2);
  });

  it('rejects fabricated directed-edge success before writing anything', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vision-topology-v2-'));
    directories.push(dir);
    const good = v2('model', 1);
    await expect(saveBenchmarkReport(dir, {
      ...good, topologySummary: { ...good.topologySummary, f1: 1 },
    })).rejects.toThrow('topology summary does not match');
    await expect(readdir(path.join(dir, 'runs'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
