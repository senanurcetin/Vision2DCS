import { validateBenchmarkReport } from './compare';

export interface TagOnlyMetrics {
  precision: number;
  recall: number;
  f1: number;
}

export interface PairedTagOnlyComparison {
  scope: 'tag-detection-only';
  drawingCount: number;
  baseline: { model: string; schemaVersion: 1 | 2; metrics: TagOnlyMetrics };
  candidate: { model: string; schemaVersion: 1 | 2; metrics: TagOnlyMetrics };
  delta: TagOnlyMetrics;
  limitations: string[];
}

/**
 * A cross-version v1/v2 comparison is meaningful ONLY for the three shared
 * tag-detection measures and ONLY when exact drawing AND reference-label
 * hashes match. Classification and topology are never silently compared.
 */
export function compareTagDetectionOnly(baselineInput: unknown, candidateInput: unknown): PairedTagOnlyComparison {
  const baseline = validateBenchmarkReport(baselineInput);
  const candidate = validateBenchmarkReport(candidateInput);
  if (baseline.sampleCount !== candidate.sampleCount) {
    throw new Error('Tag-only comparison requires the same number of drawings.');
  }
  const sources = new Map(baseline.samples.map(sample => [sample.name, sample]));
  for (const sample of candidate.samples) {
    const expected = sources.get(sample.name);
    if (!expected || expected.drawingSha256 !== sample.drawingSha256 ||
        expected.expectedSha256 !== sample.expectedSha256) {
      throw new Error('Tag-only comparison requires identical source drawings and reference labels.');
    }
  }
  const pick = ({ precision, recall, f1 }: TagOnlyMetrics): TagOnlyMetrics => ({ precision, recall, f1 });
  const original = pick(baseline.summary);
  const next = pick(candidate.summary);
  return {
    scope: 'tag-detection-only',
    drawingCount: baseline.sampleCount,
    baseline: { model: baseline.model, schemaVersion: baseline.schemaVersion, metrics: original },
    candidate: { model: candidate.model, schemaVersion: candidate.schemaVersion, metrics: next },
    delta: {
      precision: next.precision - original.precision,
      recall: next.recall - original.recall,
      f1: next.f1 - original.f1,
    },
    limitations: [
      'This compares only detected instrument tags; no I/O classification, control block or signal topology claims.',
      'A source hash identifies source bytes but does not authenticate report provenance or label quality.',
      'A shared synthetic drawing grammar is not independent generalization evidence.',
    ],
  };
}
