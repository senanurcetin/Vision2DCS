import { SampleScore, Summary, summarize } from './score';

export interface BenchmarkSample {
  name: string;
  score: SampleScore;
  /** SHA-256 of the exact input bytes, so evaluations can be compared reliably. */
  drawingSha256: string;
  expectedSha256: string;
}

export interface BenchmarkReport {
  schemaVersion: 1;
  model: string;
  generatedAt: string;
  sampleCount: number;
  scoring: 'canonical-tag-microaverage';
  samples: BenchmarkSample[];
  summary: Summary;
}

/** Constructs a data-only report; never stores provider credentials or input drawings. */
export const buildBenchmarkReport = (
  model: string,
  samples: BenchmarkSample[],
  generatedAt: string,
): BenchmarkReport => {
  if (!model.trim()) throw new Error('Benchmark model is required.');
  if (samples.length === 0) throw new Error('Benchmark requires at least one sample.');
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Benchmark timestamp must be ISO formatted.');
  const sorted = [...samples].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const names = new Set<string>();
  for (const sample of sorted) {
    if (!sample.name || names.has(sample.name)) throw new Error('Duplicate or empty benchmark sample name.');
    names.add(sample.name);
    for (const hash of [sample.drawingSha256, sample.expectedSha256]) {
      if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Benchmark source checksum must be SHA-256.');
    }
  }

  return {
    schemaVersion: 1,
    model,
    generatedAt,
    sampleCount: sorted.length,
    scoring: 'canonical-tag-microaverage',
    samples: sorted,
    summary: summarize(sorted.map(sample => sample.score)),
  };
};
