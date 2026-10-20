/**
 * Optional reproducible, CPU-only tag extraction baseline on the exact PNG
 * corpus. Requires a locally installed Tesseract OCR executable; this never
 * uses Gemini, SVG source labels, browser data or paid inference.
 *
 * npm run eval:ocr
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareBenchmarkSamples } from './preflight';
import { parseOcrInstrumentTags, OCR_BASELINE_METHOD } from './ocrBaseline';
import { scoreSample } from './score';
import { buildBenchmarkReport, type BenchmarkSample } from './report';
import { saveBenchmarkReport } from './reportFiles';

const run = promisify(execFile);
const MAX_OCR_OUTPUT = 1024 * 1024;
const options = { timeout: 30_000, maxBuffer: MAX_OCR_OUTPUT, encoding: 'utf8' as const };

async function main() {
  // Reject corrupt/mislabelled later fixtures BEFORE running even free OCR.
  const fixtures = await prepareBenchmarkSamples(path.resolve('samples'));
  let version: string;
  try {
    const output = await run('tesseract', ['--version'], { ...options, timeout: 10_000 });
    const match = (output.stdout + '\n' + output.stderr).match(/tesseract\s+([0-9]+(?:\.[0-9]+){1,3})/i);
    if (!match) throw new Error('Tesseract version could not be identified.');
    version = match[1];
  } catch {
    throw new Error('Tesseract OCR is not installed or cannot be executed. No benchmark results were produced.');
  }

  // Use temporary exact preflight-validated bytes, not a mutable source path
  // that could change while external OCR executes (TOCTOU protection).
  const dir = await mkdtemp(path.join(tmpdir(), 'vision2dcs-ocr-'));
  const samples: BenchmarkSample[] = [];
  try {
    for (const [index, fixture] of fixtures.entries()) {
      const file = path.join(dir, 'drawing-' + String(index).padStart(3, '0') + '.png');
      await writeFile(file, fixture.drawing, { mode: 0o600 });
      const { stdout } = await run('tesseract', [file, 'stdout', '-l', 'eng', '--psm', '11'], options);
      const actual = parseOcrInstrumentTags(stdout).map(tagName => ({
        tagName, signalType: 'Unknown', pcs7BlockType: 'Unknown',
      }));
      const score = scoreSample(fixture.instruments, actual);
      samples.push({
        name: fixture.name,
        drawingSha256: fixture.drawingSha256,
        expectedSha256: fixture.expectedSha256,
        score,
      });
      process.stdout.write(fixture.name + ': ' + score.matched + '/' + score.expected +
        ' tags, ' + score.extracted + ' OCR candidates\n');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const model = 'tesseract-ocr-tags-only/' + version + '/eng-psm11';
  const report = buildBenchmarkReport(model, samples, new Date().toISOString());
  const stored = await saveBenchmarkReport(path.resolve('eval/results'), report);
  process.stdout.write(JSON.stringify({
    kind: 'measured-ocr-tag-baseline',
    method: OCR_BASELINE_METHOD,
    model, drawingCount: report.sampleCount,
    tagPrecision: report.summary.precision,
    tagRecall: report.summary.recall,
    tagF1: report.summary.f1,
    classificationAndTopology: 'NOT PREDICTED. Classification fields in the v1 envelope are placeholders, not assessed skills.',
    limitations: [
      'OCR results were measured on source-labelled synthetic images using an external Tesseract binary.',
      'OCR parser and model are not interchangeable, and tags from drawings sharing one grammar are correlated.',
      'This baseline neither measures drawn signal links nor verifies IEC/ISA functional safety or DCS imports.',
    ],
    historyFile: stored.historyFile,
    latestFile: stored.latestFile,
  }, null, 2) + '\n');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'OCR baseline failed.');
  process.exitCode = 1;
});
