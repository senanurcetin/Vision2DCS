/**
 * Offline, read-only, per-drawing diagnostics for a saved real evaluation.
 *
 * npm run eval:diagnose -- eval/results/latest.json
 *
 * Never calls Gemini; historical JSON is not independently verified provider
 * provenance. No new accuracy estimates, confidence intervals or controls.
 */
import { readFile, stat } from 'node:fs/promises';
import { diagnoseBenchmarkReport } from './diagnostics';

const MAX_REPORT_BYTES = 8 * 1024 * 1024;

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    throw new Error('Usage: npm run eval:diagnose -- <validated-benchmark-report.json>');
  }
  const info = await stat(args[0]);
  if (!info.isFile() || info.size < 1 || info.size > MAX_REPORT_BYTES) {
    throw new Error('Benchmark report must be a nonempty JSON file at most 8 MiB.');
  }
  let input: unknown;
  try {
    input = JSON.parse(await readFile(args[0], 'utf8'));
  } catch {
    throw new Error('Benchmark report contains invalid JSON.');
  }
  console.log(JSON.stringify(diagnoseBenchmarkReport(input), null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Drawing diagnostics failed.');
  process.exitCode = 1;
});
