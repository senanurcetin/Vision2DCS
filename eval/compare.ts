import { summarize, type SampleScore, type Summary } from './score';
import type { BenchmarkReport } from './report';

const metricKeys = ['precision', 'recall', 'f1', 'signalAccuracy', 'blockAccuracy'] as const;
type Metric = typeof metricKeys[number];
type Metrics = Record<Metric, number>;

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const count = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const names = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0);

function validatedScore(v: unknown): SampleScore {
  if (!record(v) || !count(v.expected) || !count(v.extracted) ||
      !count(v.matched) || !count(v.signalCorrect) || !count(v.blockCorrect) ||
      !names(v.missed) || !names(v.unexpected) ||
      v.matched > Math.min(v.expected, v.extracted) ||
      v.signalCorrect > v.matched || v.blockCorrect > v.matched ||
      v.missed.length !== v.expected - v.matched ||
      v.unexpected.length !== v.extracted - v.matched) {
    throw new Error('Invalid benchmark sample scoring counts.');
  }
  return {
    expected: v.expected,
    extracted: v.extracted,
    matched: v.matched,
    signalCorrect: v.signalCorrect,
    blockCorrect: v.blockCorrect,
    missed: v.missed,
    unexpected: v.unexpected,
  };
}

/**
 * Reports are untrusted local JSON. Recalculate metrics from validated sample
 * counts; never trust an arbitrary summary field or infer missing results.
 */
export function validateBenchmarkReport(input: unknown): BenchmarkReport {
  if (!record(input) || input.schemaVersion !== 1 ||
      input.scoring !== 'canonical-tag-microaverage' ||
      typeof input.model !== 'string' || !input.model.trim() ||
      typeof input.generatedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.generatedAt) ||
      Number.isNaN(Date.parse(input.generatedAt)) ||
      new Date(input.generatedAt).toISOString() !== input.generatedAt ||
      !Array.isArray(input.samples) || input.samples.length === 0 ||
      input.samples.length > 10000 || input.sampleCount !== input.samples.length ||
      !record(input.summary)) {
    throw new Error('Invalid or unsupported benchmark report v1.');
  }
  const seen = new Set<string>();
  const samples = input.samples.map((sample: unknown) => {
    if (!record(sample) || typeof sample.name !== 'string' ||
        !sample.name.trim() || sample.name.length > 200 ||
        seen.has(sample.name) || !hash(sample.drawingSha256) ||
        !hash(sample.expectedSha256)) {
      throw new Error('Benchmark contains duplicated or untraceable sample identity.');
    }
    seen.add(sample.name);
    return {
      name: sample.name,
      drawingSha256: sample.drawingSha256 as string,
      expectedSha256: sample.expectedSha256 as string,
      score: validatedScore(sample.score),
    };
  });
  const summary = summarize(samples.map(s => s.score));
  for (const key of metricKeys) {
    const actual = input.summary[key];
    if (typeof actual !== 'number' || !Number.isFinite(actual) ||
        actual < 0 || actual > 1 || Math.abs(actual - summary[key]) > 1e-9) {
      throw new Error('Benchmark summary does not match sample evidence.');
    }
  }
  return {
    schemaVersion: 1,
    model: input.model,
    generatedAt: input.generatedAt,
    scoring: 'canonical-tag-microaverage',
    sampleCount: samples.length,
    samples,
    summary,
  };
}

export interface PairedBenchmarkComparison {
  baselineModel: string;
  candidateModel: string;
  sampleCount: number;
  baseline: Metrics;
  candidate: Metrics;
  delta: Metrics;
}

/** Reject unequal source sets, altered labels or switched drawing content. */
export function compareBenchmarkReports(
  baselineInput: unknown,
  candidateInput: unknown,
): PairedBenchmarkComparison {
  const baseline = validateBenchmarkReport(baselineInput);
  const candidate = validateBenchmarkReport(candidateInput);
  if (baseline.sampleCount !== candidate.sampleCount) {
    throw new Error('Benchmark sample counts differ; comparison is invalid.');
  }
  const source = new Map(baseline.samples.map(s => [s.name, s]));
  for (const sample of candidate.samples) {
    const other = source.get(sample.name);
    if (!other || other.drawingSha256 !== sample.drawingSha256 ||
        other.expectedSha256 !== sample.expectedSha256) {
      throw new Error('Benchmark drawings or reference labels differ; do not compare metrics.');
    }
  }
  const delta = {} as Metrics;
  for (const key of metricKeys) delta[key] = candidate.summary[key] - baseline.summary[key];
  return {
    baselineModel: baseline.model,
    candidateModel: candidate.model,
    sampleCount: baseline.sampleCount,
    baseline: baseline.summary,
    candidate: candidate.summary,
    delta,
  };
}
