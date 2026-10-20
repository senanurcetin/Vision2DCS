import type { PreparedBenchmarkSample } from './preflight';

/**
 * This is a dataset inventory, NOT a model accuracy report. The primary
 * unit for empirical generalization is an independent drawing, not each tag
 * within a drawing. Correlated tags must not masquerade as independent tests.
 */
export interface BenchmarkInventory {
  kind: 'unscored-offline-fixture-inventory';
  drawingCount: number;
  taggedInstruments: number;
  directedSignalLinks: number;
  signalClassCounts: Record<'AI' | 'AO' | 'DI' | 'DO', number>;
  pcs7BlockCounts: Record<string, number>;
  ambiguousReferenceTypes: number;
  samples: {
    name: string; instrumentCount: number; signalLinkCount: number;
    drawingSha256: string; expectedSha256: string;
  }[];
  independentDrawingEvidence: 'insufficient' | 'candidate-only';
  limitations: string[];
}

export const inspectBenchmarkCorpus = (
  fixtures: ReadonlyArray<PreparedBenchmarkSample>,
): BenchmarkInventory => {
  const counts: BenchmarkInventory['signalClassCounts'] = { AI: 0, AO: 0, DI: 0, DO: 0 };
  const blocks: Record<string, number> = {};
  let ambiguousReferenceTypes = 0;
  let edges = 0;
  let tagged = 0;
  const samples = [...fixtures].sort((a, b) => a.name.localeCompare(b.name)).map(fixture => {
    tagged += fixture.instruments.length;
    edges += fixture.signalConnections.length;
    for (const instrument of fixture.instruments) {
      const signals = Array.isArray(instrument.signalType) ? instrument.signalType : [instrument.signalType];
      const blockTypes = Array.isArray(instrument.pcs7BlockType)
        ? instrument.pcs7BlockType : [instrument.pcs7BlockType];
      if (signals.length > 1 || blockTypes.length > 1) ambiguousReferenceTypes++;
      for (const signal of signals) {
        if (signal && Object.prototype.hasOwnProperty.call(counts, signal)) {
          counts[signal as keyof typeof counts]++;
        }
      }
      for (const block of blockTypes) if (block) blocks[block] = (blocks[block] ?? 0) + 1;
    }
    return {
      name: fixture.name,
      instrumentCount: fixture.instruments.length,
      signalLinkCount: fixture.signalConnections.length,
      drawingSha256: fixture.drawingSha256,
      expectedSha256: fixture.expectedSha256,
    };
  });
  return {
    kind: 'unscored-offline-fixture-inventory',
    drawingCount: samples.length,
    taggedInstruments: tagged,
    directedSignalLinks: edges,
    signalClassCounts: counts,
    pcs7BlockCounts: Object.fromEntries(Object.entries(blocks).sort(([a],[b]) => a.localeCompare(b))),
    ambiguousReferenceTypes,
    samples,
    independentDrawingEvidence: samples.length < 30 ? 'insufficient' : 'candidate-only',
    limitations: [
      'The corpus contains hand-authored synthetic drawings, not independent plant engineering samples.',
      'No provider/model inference was executed, so this inventory contains no extraction accuracy metrics.',
      'Tags and signal links within a drawing are correlated; counting them as independent drawings inflates confidence.',
      samples.length < 30
        ? 'Fewer than 30 distinct drawings: no reliable estimate of generalization across P&ID styles.'
        : 'Thirty or more drawings is a practical coverage target, not a proof of generalization.',
      'PCS7 and ABB concept exports are not vendor import schema certified.',
    ],
  };
};
