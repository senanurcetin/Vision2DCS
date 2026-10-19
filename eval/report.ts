import { SampleScore, Summary, summarize } from './score';
import { type TopologyScore, type TopologySummary, summarizeTopology } from './topology';

export interface BenchmarkSample {
  name: string;
  score: SampleScore;
  /** SHA-256 of the exact source bytes, to prevent comparing changed labels. */
  drawingSha256: string;
  expectedSha256: string;
}

export interface BenchmarkTopologySample extends BenchmarkSample {
  /** Explicitly labelled directed instrument-signal edges only. */
  topologyScore: TopologyScore;
}

export interface BenchmarkReportV1 {
  schemaVersion: 1;
  model: string;
  generatedAt: string;
  sampleCount: number;
  scoring: 'canonical-tag-microaverage';
  samples: BenchmarkSample[];
  summary: Summary;
}

export interface BenchmarkReportV2 {
  schemaVersion: 2;
  model: string;
  generatedAt: string;
  sampleCount: number;
  scoring: 'canonical-tags-and-directed-signals';
  samples: BenchmarkTopologySample[];
  summary: Summary;
  topologySummary: TopologySummary;
}

/** Historical v1 reports stay readable, never silently upgraded to v2. */
export type BenchmarkReport = BenchmarkReportV1 | BenchmarkReportV2;

const validTimestamp = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString() === value;

const validateSources = (model: string, samples: BenchmarkSample[], generatedAt: string): BenchmarkSample[] => {
  if (!model.trim()) throw new Error('Benchmark model is required.');
  if (samples.length === 0) throw new Error('Benchmark requires at least one sample.');
  if (samples.length > 10000) throw new Error('Benchmark has too many samples.');
  if (!validTimestamp(generatedAt)) throw new Error('Benchmark timestamp must be valid UTC ISO formatted.');
  const sorted = [...samples].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const names = new Set<string>();
  for (const sample of sorted) {
    if (!sample.name || sample.name.length > 200 || names.has(sample.name)) {
      throw new Error('Duplicate, empty or oversized benchmark sample name.');
    }
    names.add(sample.name);
    for (const hash of [sample.drawingSha256, sample.expectedSha256]) {
      if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Benchmark source checksum must be SHA-256.');
    }
  }
  return sorted;
};

/** Legacy report builder for reproducing and testing historical v1 evidence. */
export const buildBenchmarkReport = (
  model: string,
  samples: BenchmarkSample[],
  generatedAt: string,
): BenchmarkReportV1 => {
  const sorted = validateSources(model, samples, generatedAt);
  return {
    schemaVersion: 1, model, generatedAt,
    sampleCount: sorted.length, scoring: 'canonical-tag-microaverage',
    samples: sorted, summary: summarize(sorted.map(sample => sample.score)),
  };
};

/**
 * Persist topology only when EVERY sample has engineer-labelled directed
 * signal connections; never mix partial topology samples into an overall F1.
 * The report is a data record, NOT a certified model-performance claim.
 */
export const buildTopologyBenchmarkReport = (
  model: string,
  samples: BenchmarkTopologySample[],
  generatedAt: string,
): BenchmarkReportV2 => {
  const sorted = validateSources(model, samples, generatedAt) as BenchmarkTopologySample[];
  if (sorted.some(s => !s.topologyScore)) {
    throw new Error('Benchmark v2 requires a topology score for every sample.');
  }
  return {
    schemaVersion: 2, model, generatedAt,
    sampleCount: sorted.length, scoring: 'canonical-tags-and-directed-signals',
    samples: sorted,
    summary: summarize(sorted.map(s => s.score)),
    topologySummary: summarizeTopology(sorted.map(s => s.topologyScore)),
  };
};
