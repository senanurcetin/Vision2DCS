import { summarize, type SampleScore, type Summary } from './score';
import { summarizeTopology, type TopologyScore, type TopologySummary } from './topology';
import type { BenchmarkReport, BenchmarkTopologySample, BenchmarkSample } from './report';

const metricKeys = ['precision', 'recall', 'f1', 'signalAccuracy', 'blockAccuracy'] as const;
type Metric = typeof metricKeys[number];
type Metrics = Record<Metric, number>;
const topologyKeys = ['precision', 'recall', 'f1'] as const;

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const count = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const names = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0);
const validTimestamp = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString() === value;

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
    expected: v.expected, extracted: v.extracted, matched: v.matched,
    signalCorrect: v.signalCorrect, blockCorrect: v.blockCorrect,
    missed: v.missed, unexpected: v.unexpected,
  };
}

function validatedTopologyScore(v: unknown): TopologyScore {
  if (!record(v) || !count(v.expected) || !count(v.extracted) || !count(v.matched) ||
      !names(v.missed) || !names(v.unexpected) ||
      v.matched > Math.min(v.expected, v.extracted) ||
      v.missed.length !== v.expected - v.matched ||
      v.unexpected.length !== v.extracted - v.matched ||
      new Set(v.missed).size !== v.missed.length ||
      new Set(v.unexpected).size !== v.unexpected.length) {
    throw new Error('Invalid benchmark directed signal-topology scoring counts.');
  }
  return {
    expected: v.expected, extracted: v.extracted, matched: v.matched,
    missed: v.missed, unexpected: v.unexpected,
  };
}

function verifySummary(
  declared: unknown,
  recalculated: Record<string, number>,
  keys: readonly string[],
  kind: string,
): void {
  if (!record(declared)) throw new Error('Benchmark ' + kind + ' summary is missing.');
  for (const key of keys) {
    const actual = declared[key];
    if (typeof actual !== 'number' || !Number.isFinite(actual) ||
        actual < 0 || actual > 1 || Math.abs(actual - recalculated[key]) > 1e-9) {
      throw new Error('Benchmark ' + kind + ' summary does not match sample evidence.');
    }
  }
}

/** Read-only validation of externally supplied historical reports. */
export function validateBenchmarkReport(input: unknown): BenchmarkReport {
  if (!record(input) || (input.schemaVersion !== 1 && input.schemaVersion !== 2) ||
      (input.schemaVersion === 1 && input.scoring !== 'canonical-tag-microaverage') ||
      (input.schemaVersion === 2 && input.scoring !== 'canonical-tags-and-directed-signals') ||
      typeof input.model !== 'string' || !input.model.trim() ||
      typeof input.generatedAt !== 'string' || !validTimestamp(input.generatedAt) ||
      !Array.isArray(input.samples) || input.samples.length === 0 ||
      input.samples.length > 10000 || input.sampleCount !== input.samples.length) {
    throw new Error('Invalid or unsupported benchmark report version.');
  }
  const seen = new Set<string>();
  const samples: (BenchmarkSample | BenchmarkTopologySample)[] = input.samples.map((sample: unknown) => {
    if (!record(sample) || typeof sample.name !== 'string' ||
        !sample.name.trim() || sample.name.length > 200 ||
        seen.has(sample.name) || !hash(sample.drawingSha256) ||
        !hash(sample.expectedSha256)) {
      throw new Error('Benchmark contains duplicated or untraceable sample identity.');
    }
    seen.add(sample.name);
    const base: BenchmarkSample = {
      name: sample.name, drawingSha256: sample.drawingSha256 as string,
      expectedSha256: sample.expectedSha256 as string, score: validatedScore(sample.score),
    };
    if (input.schemaVersion === 2) {
      return { ...base, topologyScore: validatedTopologyScore(sample.topologyScore) };
    }
    if (sample.topologyScore !== undefined) {
      throw new Error('Topology evidence cannot be stored in a v1 report.');
    }
    return base;
  });
  const summary: Summary = summarize(samples.map(s => s.score));
  verifySummary(input.summary, summary, metricKeys, 'tag');

  if (input.schemaVersion === 2) {
    const topologySamples = samples as BenchmarkTopologySample[];
    const topologySummary: TopologySummary = summarizeTopology(topologySamples.map(s => s.topologyScore));
    verifySummary(input.topologySummary, topologySummary, topologyKeys, 'topology');
    return {
      schemaVersion: 2, model: input.model, generatedAt: input.generatedAt,
      scoring: 'canonical-tags-and-directed-signals',
      sampleCount: samples.length, samples: topologySamples, summary, topologySummary,
    };
  }
  if (input.topologySummary !== undefined) {
    throw new Error('Topology summary cannot be stored in a v1 report.');
  }
  return {
    schemaVersion: 1, model: input.model, generatedAt: input.generatedAt,
    scoring: 'canonical-tag-microaverage', sampleCount: samples.length,
    samples: samples as BenchmarkSample[], summary,
  };
}

export interface PairedBenchmarkComparison {
  baselineModel: string;
  candidateModel: string;
  sampleCount: number;
  baseline: Metrics;
  candidate: Metrics;
  delta: Metrics;
  topology?: {
    baseline: TopologySummary;
    candidate: TopologySummary;
    delta: TopologySummary;
  };
}

/**
 * Compare only identical source drawings/labels, and NEVER compare v1 tag-only
 * records with v2 topology-aware reports as though they measured the same thing.
 */
export function compareBenchmarkReports(
  baselineInput: unknown,
  candidateInput: unknown,
): PairedBenchmarkComparison {
  const baseline = validateBenchmarkReport(baselineInput);
  const candidate = validateBenchmarkReport(candidateInput);
  if (baseline.schemaVersion !== candidate.schemaVersion) {
    throw new Error('Benchmark schema versions differ; compare matching report versions.');
  }
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

  const topology = baseline.schemaVersion === 2 && candidate.schemaVersion === 2
    ? {
      baseline: baseline.topologySummary,
      candidate: candidate.topologySummary,
      delta: {
        precision: candidate.topologySummary.precision - baseline.topologySummary.precision,
        recall: candidate.topologySummary.recall - baseline.topologySummary.recall,
        f1: candidate.topologySummary.f1 - baseline.topologySummary.f1,
      },
    }
    : undefined;
  return {
    baselineModel: baseline.model, candidateModel: candidate.model,
    sampleCount: baseline.sampleCount, baseline: baseline.summary,
    candidate: candidate.summary, delta,
    ...(topology ? { topology } : {}),
  };
}
