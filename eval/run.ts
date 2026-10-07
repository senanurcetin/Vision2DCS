/**
 * Extraction benchmark: runs every samples/<name>/drawing.png through Gemini
 * and compares the result with samples/<name>/expected.json.
 *
 *   npm run eval            (reads GEMINI_API_KEY from the env or .env.local)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { readServerConfig } from '../server/config';
import { createGeminiService } from '../server/gemini';
import { ExpectedInstrument, SampleScore, scoreSample, summarize } from './score';

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
  for (const name of names) {
    const dir = path.join(samplesDir, name);
    const { instruments: expected } = JSON.parse(await readFile(path.join(dir, 'expected.json'), 'utf8')) as { instruments: ExpectedInstrument[] };
    const image = (await readFile(path.join(dir, 'drawing.png'))).toString('base64');

    const started = Date.now();
    const extracted = await gemini.analyze({ data: image, mimeType: 'image/png' });
    const score = scoreSample(expected, extracted);
    scores.push(score);

    console.log(`${name}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    console.log(`  tags ${score.matched}/${score.expected} found, ${score.extracted} extracted`);
    console.log(`  signal type ${score.signalCorrect}/${score.matched}, block type ${score.blockCorrect}/${score.matched}`);
    if (score.missed.length) console.log(`  missed: ${score.missed.join(', ')}`);
    if (score.unexpected.length) console.log(`  unexpected: ${score.unexpected.join(', ')}`);
  }

  const s = summarize(scores);
  console.log(`\nOverall  precision ${pct(s.precision)}  recall ${pct(s.recall)}  F1 ${pct(s.f1)}  signal ${pct(s.signalAccuracy)}  block ${pct(s.blockAccuracy)}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
