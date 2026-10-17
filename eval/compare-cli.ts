/** Compare two previously generated, local benchmark JSON reports.
 * Zero provider/model calls; refuses changed source drawings or labels.
 *
 * npm run eval:compare -- eval/results/old.json eval/results/new.json
 */
import { readFile, stat } from 'node:fs/promises';
import { compareBenchmarkReports } from './compare';

const MAX_REPORT_BYTES = 8 * 1024 * 1024;

async function readReport(file: string): Promise<unknown> {
  const info = await stat(file);
  if (!info.isFile() || info.size < 1 || info.size > MAX_REPORT_BYTES) {
    throw new Error('Benchmark report must be a nonempty JSON file at most 8 MiB.');
  }
  let data: unknown;
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new Error('Benchmark report contains invalid JSON.');
  }
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    throw new Error('Usage: npm run eval:compare -- <baseline.json> <candidate.json>');
  }
  const comparison = compareBenchmarkReports(
    await readReport(args[0]),
    await readReport(args[1]),
  );
  console.log(JSON.stringify(comparison, null, 2));
  console.log('Paired comparison only: no inference, model bill or certified accuracy claim.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Benchmark comparison failed.');
  process.exitCode = 1;
});
