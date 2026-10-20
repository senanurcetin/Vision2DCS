import { validateBenchmarkReport } from './compare';
import type { BenchmarkReport } from './report';
import type { SampleScore } from './score';
import type { TopologyScore } from './topology';

/**
 * An absent denominator is *undefined*, not a perfect score. A drawing with
 * ground-truth tags/edges but zero predictions has F1=0 (a real miss).
 * The drawing, not the individual tag, is the unit of a macro-average.
 */
export interface DrawingTagMetrics {
  precision: number | null;
  recall: number | null;
  f1: number | null;
  signalAccuracy: number | null;
  blockAccuracy: number | null;
}

export interface DrawingTopologyMetrics {
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface DrawingDiagnostic {
  name: string;
  drawingSha256: string;
  expectedSha256: string;
  tags: { expected: number; extracted: number; matched: number; metrics: DrawingTagMetrics };
  topology?: { expected: number; extracted: number; matched: number; metrics: DrawingTopologyMetrics };
}

export interface MacroMeasure {
  /** Null means no drawings had a defined denominator for this metric. */
  mean: number | null;
  evaluatedDrawings: number;
}

export interface BenchmarkDiagnostics {
  kind: 'unverified-historical-report-diagnostics';
  schemaVersion: 1 | 2;
  model: string;
  generatedAt: string;
  drawingCount: number;
  /** These are existing report aggregates; never recompute scores from fabricated predictions. */
  micro: BenchmarkReport['summary'];
  microTopology?: DrawingTopologyMetrics;
  drawings: DrawingDiagnostic[];
  macroTags: Record<keyof DrawingTagMetrics, MacroMeasure>;
  macroTopology?: Record<keyof DrawingTopologyMetrics, MacroMeasure>;
  weakestTagDrawing: string | null;
  weakestTopologyDrawing?: string | null;
  limitations: string[];
}

const ratio = (part: number, whole: number): number | null =>
  whole === 0 ? null : part / whole;

// 2TP/(number predicted + number labelled) stays zero for a complete miss.
// Zero labelled and zero predicted is undefined, never silently scored as 1.
const countF1 = (matched: number, expected: number, extracted: number): number | null =>
  expected + extracted === 0 ? null : (2 * matched) / (expected + extracted);

const scoreTags = (s: SampleScore): DrawingTagMetrics => ({
  precision: ratio(s.matched, s.extracted),
  recall: ratio(s.matched, s.expected),
  f1: countF1(s.matched, s.expected, s.extracted),
  signalAccuracy: ratio(s.signalCorrect, s.matched),
  blockAccuracy: ratio(s.blockCorrect, s.matched),
});

const scoreTopology = (s: TopologyScore): DrawingTopologyMetrics => ({
  precision: ratio(s.matched, s.extracted),
  recall: ratio(s.matched, s.expected),
  f1: countF1(s.matched, s.expected, s.extracted),
});

const macro = (values: ReadonlyArray<number | null>): MacroMeasure => {
  const defined = values.filter((value): value is number => value !== null);
  return {
    mean: defined.length === 0 ? null : defined.reduce((sum, value) => sum + value, 0) / defined.length,
    evaluatedDrawings: defined.length,
  };
};

const weakest = (drawings: DrawingDiagnostic[], value: (row: DrawingDiagnostic) => number | null) => {
  const scored = drawings.filter(row => value(row) !== null);
  scored.sort((a, b) => (value(a)! - value(b)!) || a.name.localeCompare(b.name, 'en'));
  return scored[0]?.name ?? null;
};

/**
 * Pure offline post-processing of existing, strictly validated v1/v2 reports.
 * No Gemini access, probability calibration, bootstrap confidence interval,
 * independence claim, synthetic accuracy, or vendor conformance is implied.
 */
export function diagnoseBenchmarkReport(input: unknown): BenchmarkDiagnostics {
  const report = validateBenchmarkReport(input);
  const drawings: DrawingDiagnostic[] = report.samples.map(sample => {
    const output: DrawingDiagnostic = {
      name: sample.name,
      drawingSha256: sample.drawingSha256,
      expectedSha256: sample.expectedSha256,
      tags: {
        expected: sample.score.expected,
        extracted: sample.score.extracted,
        matched: sample.score.matched,
        metrics: scoreTags(sample.score),
      },
    };
    if (report.schemaVersion === 2) {
      const match = report.samples.find(candidate => candidate.name === sample.name);
      // report.samples is validated as a homogeneous v2 collection.
      const s = (match as (typeof report.samples)[number]).topologyScore;
      output.topology = {
        expected: s.expected, extracted: s.extracted, matched: s.matched,
        metrics: scoreTopology(s),
      };
    }
    return output;
  }).sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const tagKeys = ['precision', 'recall', 'f1', 'signalAccuracy', 'blockAccuracy'] as const;
  const macroTags = {} as BenchmarkDiagnostics['macroTags'];
  for (const key of tagKeys) {
    macroTags[key] = macro(drawings.map(row => row.tags.metrics[key]));
  }

  const result: BenchmarkDiagnostics = {
    kind: 'unverified-historical-report-diagnostics',
    schemaVersion: report.schemaVersion,
    model: report.model,
    generatedAt: report.generatedAt,
    drawingCount: drawings.length,
    micro: report.summary,
    drawings,
    macroTags,
    weakestTagDrawing: weakest(drawings, row => row.tags.metrics.f1),
    limitations: [
      'All figures are recomputed from supplied source-hashed report counts; provider provenance is not independently verified.',
      'The drawing is the macro-average unit. Multiple correlated drawings from one procedural grammar do not establish generalization.',
      'Undefined denominators are null and excluded from the corresponding macro-average; evaluatedDrawings discloses coverage.',
      'A total miss against a nonempty reference set has F1=0; a doubly empty reference/prediction set has undefined F1.',
      'Neither interval estimates, plant safety compliance nor vendor import validity are inferred.',
    ],
  };
  if (report.schemaVersion === 2) {
    const topoKeys = ['precision', 'recall', 'f1'] as const;
    const macroTopology = {} as NonNullable<BenchmarkDiagnostics['macroTopology']>;
    for (const key of topoKeys) {
      macroTopology[key] = macro(drawings.map(row => row.topology?.metrics[key] ?? null));
    }
    result.macroTopology = macroTopology;
    result.microTopology = report.topologySummary;
    result.weakestTopologyDrawing = weakest(drawings, row => row.topology?.metrics.f1 ?? null);
  }
  return result;
}
