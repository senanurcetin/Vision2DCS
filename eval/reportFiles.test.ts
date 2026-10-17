import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildBenchmarkReport, type BenchmarkSample } from './report';
import { saveBenchmarkReport } from './reportFiles';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(folder => rm(folder, { recursive: true, force: true })));
});

function report(date: string, matched: number) {
  const sample: BenchmarkSample = {
    name: 'pid-a',
    drawingSha256: 'a'.repeat(64),
    expectedSha256: 'b'.repeat(64),
    score: {
      expected: 2, extracted: 2, matched,
      signalCorrect: matched, blockCorrect: matched,
      missed: matched === 1 ? ['TT-102'] : [],
      unexpected: matched === 1 ? ['PT-999'] : [],
    },
  };
  return buildBenchmarkReport('offline-model-label', [sample], date);
}

describe('source-hashed benchmark artifact persistence', () => {
  it('retains independent historical runs while atomically moving the latest pointer', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nexus-pid-report-'));
    directories.push(dir);
    const baseline = report('2026-10-17T10:00:00.000Z', 1);
    const candidate = report('2026-10-17T11:00:00.000Z', 2);
    const first = await saveBenchmarkReport(dir, baseline);
    const before = await readFile(first.historyFile, 'utf8');
    const second = await saveBenchmarkReport(dir, candidate);
    const files = await readdir(path.join(dir, 'runs'));
    expect(files).toHaveLength(2);
    expect(first.historyFile).not.toBe(second.historyFile);
    expect(await readFile(first.historyFile, 'utf8')).toBe(before);
    expect(JSON.parse(await readFile(second.latestFile, 'utf8')).summary.f1).toBe(1);
    expect(JSON.parse(before).summary.f1).toBeCloseTo(0.5);
  });

  it('refuses to overwrite identical historical evidence', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nexus-pid-report-'));
    directories.push(dir);
    const candidate = report('2026-10-17T10:00:00.000Z', 1);
    await saveBenchmarkReport(dir, candidate);
    await expect(saveBenchmarkReport(dir, candidate)).rejects.toMatchObject({ code: 'EEXIST' });
    expect((await readdir(path.join(dir, 'runs')))).toHaveLength(1);
  });

  it('rejects tampered summary before creating any history directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nexus-pid-report-'));
    directories.push(dir);
    const good = report('2026-10-17T10:00:00.000Z', 1);
    await expect(saveBenchmarkReport(dir, {
      ...good, summary: { ...good.summary, f1: 1 },
    })).rejects.toThrow('summary does not match');
    await expect(readdir(path.join(dir, 'runs'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
