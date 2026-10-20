/** Compare source-matched reports exclusively on tag detection, even v1/v2. */
import { readFile, stat } from 'node:fs/promises';
import { compareTagDetectionOnly } from './compareTags';

async function readReport(file: string): Promise<unknown> {
  const info = await stat(file);
  if (!info.isFile() || info.size < 1 || info.size > 8 * 1024 * 1024) {
    throw new Error('Tag comparison reports must be JSON files of at most 8 MiB.');
  }
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { throw new Error('Tag comparison report is not valid JSON.'); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    throw new Error('Usage: npm run eval:compare-tags -- <baseline.json> <candidate.json>');
  }
  const result = compareTagDetectionOnly(await readReport(args[0]), await readReport(args[1]));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Tag comparison failed.');
  process.exitCode = 1;
});
