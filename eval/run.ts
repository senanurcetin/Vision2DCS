/**
 * Extraction benchmark: runs every samples/<name>/drawing.png through Gemini
 * and compares the result with samples/<name>/expected.json.
 *
 *   npm run eval            (reads GEMINI_API_KEY from the env or .env.local)
 */
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadEnv } from 'vite';
import { readServerConfig } from '../server/config';
import { createGeminiService } from '../server/gemini';
import { ExpectedInstrument, SampleScore, scoreSample, summarize } from './score';
import { ExpectedSignalConnection, TopologyScore, scoreExplicitSignalConnections, summarizeTopology } from './topology';
import { BenchmarkSample, buildBenchmarkReport } from './report';
import { saveBenchmarkReport } from './reportFiles';

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
  const topologyScores: TopologyScore[] = [];
  const recordedSamples: BenchmarkSample[] = [];
  for (const name of names) {
    const dir = path.join(samplesDir, name);
    const expectedBytes = await readFile(path.join(dir, 'expected.json'));
    const { instruments: expected, signalConnections } = JSON.parse(expectedBytes.toString('utf8')) as {
      instruments: ExpectedInstrument[];
      signalConnections?: ExpectedSignalConnection[];
    };
    const drawingBytes = await readFile(path.join(dir, 'drawing.png'));
    const image = drawingBytes.toString('base64');

    const started = Date.now();
    const extracted = await gemini.analyze({ data: image, mimeType: 'image/png' });
    const score = scoreSample(expected, extracted);
    scores.push(score);
    // Drawn dashed signal connections only: never score inferred React Flow links.
    const topology = signalConnections
      ? scoreExplicitSignalConnections(signalConnections, expected.map(i => i.tagName), extracted)
      : undefined;
    if (topology) topologyScores.push(topology);
    recordedSamples.push({
      name,
      score,
      drawingSha256: createHash('sha256').update(drawingBytes).digest('hex'),
      expectedSha256: createHash('sha256').update(expectedBytes).digest('hex'),
    });

    console.log(`${name}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    console.log(`  tags ${score.matched}/${score.expected} found, ${score.extracted} extracted`);
    console.log(`  signal type ${score.signalCorrect}/${score.matched}, block type ${score.blockCorrect}/${score.matched}`);
    if (topology) {
      console.log(`  drawn signal connections ${topology.matched}/${topology.expected} found, ${topology.extracted} extracted`);
      if (topology.missed.length) console.log(`  missed connections: ${topology.missed.join(', ')}`);
      if (topology.unexpected.length) console.log(`  unexpected connections: ${topology.unexpected.join(', ')}`);
    }
    if (score.missed.length) console.log(`  missed: ${score.missed.join(', ')}`);
    if (score.unexpected.length) console.log(`  unexpected: ${score.unexpected.join(', ')}`);
  }

  const s = summarize(scores);
  console.log(`\nOverall  precision ${pct(s.precision)}  recall ${pct(s.recall)}  F1 ${pct(s.f1)}  signal ${pct(s.signalAccuracy)}  block ${pct(s.blockAccuracy)}`);

  if (topologyScores.length) {
    const topologySummary = summarizeTopology(topologyScores);
    console.log(`Explicit signal topology (${topologyScores.length} labelled drawings): precision ${pct(topologySummary.precision)}, recall ${pct(topologySummary.recall)}, F1 ${pct(topologySummary.f1)}`);
    console.log('Signal-topology metrics are console-only; historical v1 reports and eval:compare remain tag-based.');
  }

  // Only runs following an explicit 'npm run eval' invocation with a real
  // provider key. Never run paid inference from CI or fabricate benchmark scores.
  const report = buildBenchmarkReport(config.analysisModel, recordedSamples, new Date().toISOString());
  const reportDir = path.resolve('eval/results');
  const saved = await saveBenchmarkReport(reportDir, report);
  console.log(`Historical benchmark evidence: ${saved.historyFile}`);
  console.log(`Most recent benchmark evidence: ${saved.latestFile}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
