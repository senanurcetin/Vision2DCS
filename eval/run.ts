/**
 * Extraction benchmark: runs every samples/<name>/drawing.png through Gemini
 * and compares the result with samples/<name>/expected.json.
 *
 *   npm run eval            (reads GEMINI_API_KEY from the env or .env.local)
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadEnv } from 'vite';
import { readServerConfig } from '../server/config';
import { createGeminiService } from '../server/gemini';
import { ExpectedInstrument, SampleScore, scoreSample, summarize } from './score';
import { BenchmarkSample, buildBenchmarkReport } from './report';

const samplesDir = path.resolve('samples');
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

const main = async () => {
  const config = readServerConfig({ ...loadEnv('', process.cwd(), ''), ...process.env });
  if (!config.apiKey) {
    console.error('GEMINI_API_KEY is not set. Add it to .env.local or the environment.');
    process.exit(1);
  }
  const gemini = createGeminiService({ ...config, apiKey: config.apiKey });
  console.log(`Model: ${config.analysisModel}\n`);

  const names = (await readdir(samplesDir, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort();
  const scores: SampleScore[] = [];
  const recordedSamples: BenchmarkSample[] = [];
  for (const name of names) {
    const dir = path.join(samplesDir, name);
    const expectedBytes = await readFile(path.join(dir, 'expected.json'));
    const { instruments: expected } = JSON.parse(expectedBytes.toString('utf8')) as { instruments: ExpectedInstrument[] };
    const drawingBytes = await readFile(path.join(dir, 'drawing.png'));
    const image = drawingBytes.toString('base64');

    const started = Date.now();
    const extracted = await gemini.analyze({ data: image, mimeType: 'image/png' });
    const score = scoreSample(expected, extracted);
    scores.push(score);
    recordedSamples.push({
      name,
      score,
      drawingSha256: createHash('sha256').update(drawingBytes).digest('hex'),
      expectedSha256: createHash('sha256').update(expectedBytes).digest('hex'),
    });

    console.log(`${name}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    console.log(`  tags ${score.matched}/${score.expected} found, ${score.extracted} extracted`);
    console.log(`  signal type ${score.signalCorrect}/${score.matched}, block type ${score.blockCorrect}/${score.matched}`);
    if (score.missed.length) console.log(`  missed: ${score.missed.join(', ')}`);
    if (score.unexpected.length) console.log(`  unexpected: ${score.unexpected.join(', ')}`);
  }

  const s = summarize(scores);
  console.log(`\nOverall  precision ${pct(s.precision)}  recall ${pct(s.recall)}  F1 ${pct(s.f1)}  signal ${pct(s.signalAccuracy)}  block ${pct(s.blockAccuracy)}`);

  // Only runs following an explicit 'npm run eval' invocation with a real
  // provider key. Never run paid inference from CI or fabricate benchmark scores.
  const report = buildBenchmarkReport(config.analysisModel, recordedSamples, new Date().toISOString());
  const reportDir = path.resolve('eval/results');
  await mkdir(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, 'latest.json');
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Reproducible benchmark evidence: ${reportFile}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
