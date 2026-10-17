import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BenchmarkReport } from './report';
import { validateBenchmarkReport } from './compare';

export interface SavedBenchmark {
  historyFile: string;
  latestFile: string;
}

/**
 * Retain each complete, source-hashed evaluation before updating latest.json.
 * History is append-only; no benchmark scores are generated or inferred here.
 * The latest pointer is replaced atomically to avoid truncated JSON on crash.
 */
export async function saveBenchmarkReport(
  outputDir: string,
  candidate: BenchmarkReport,
): Promise<SavedBenchmark> {
  const report = validateBenchmarkReport(candidate);
  const payload = JSON.stringify(report, null, 2) + '\n';
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 16);
  const timestamp = report.generatedAt.replace(/[-:.]/g, '');
  const runsDir = path.join(outputDir, 'runs');
  await mkdir(runsDir, { recursive: true });
  const historyFile = path.join(runsDir, timestamp + '-' + digest + '.json');
  // 'wx' avoids silently overwriting a previous benchmark artifact.
  await writeFile(historyFile, payload, { encoding: 'utf8', flag: 'wx' });

  const latestFile = path.join(outputDir, 'latest.json');
  const temporary = path.join(outputDir, '.latest-' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, payload, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, latestFile);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return { historyFile, latestFile };
}
