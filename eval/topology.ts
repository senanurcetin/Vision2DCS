import { canonicalTag } from './score';

export interface ExpectedSignalConnection {
  source: string;
  target: string;
}

export interface ExtractedSignalConnection {
  tagName: string;
  connectedTo?: string;
}

export interface TopologyScore {
  expected: number;
  extracted: number;
  matched: number;
  missed: string[];
  unexpected: string[];
}

export interface TopologySummary {
  precision: number;
  recall: number;
  f1: number;
}

const key = (source: string, target: string) => source + '\u0000' + target;
const display = (edge: string) => edge.replace('\u0000', ' -> ');
const ratio = (part: number, whole: number) => whole === 0 ? 0 : part / whole;

/**
 * Score only explicitly annotated directed instrument signal links.
 * The UI's inferred loop chains and process piping are NOT ground truth.
 * Dangling, reversed and self-referencing model edges count as false positives.
 */
export function scoreExplicitSignalConnections(
  expectedConnections: ExpectedSignalConnection[],
  expectedTagNames: string[],
  extracted: ExtractedSignalConnection[],
): TopologyScore {
  const expectedTags = new Set(expectedTagNames.map(canonicalTag));
  if (expectedTags.size !== expectedTagNames.length) {
    throw new Error('Duplicate canonical reference tag in topology labels.');
  }

  const expectedEdges = new Set<string>();
  for (const edge of expectedConnections) {
    if (!edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      throw new Error('Invalid expected signal connection.');
    }
    const source = canonicalTag(edge.source);
    const target = canonicalTag(edge.target);
    if (!expectedTags.has(source) || !expectedTags.has(target) || source === target) {
      throw new Error('Expected signal connection contains an unknown or self-referencing tag.');
    }
    const edgeKey = key(source, target);
    if (expectedEdges.has(edgeKey)) throw new Error('Duplicate expected signal connection.');
    expectedEdges.add(edgeKey);
  }

  const observed = new Map<string, string>();
  for (const instrument of extracted) {
    const source = canonicalTag(instrument.tagName);
    const target = instrument.connectedTo?.trim() ? canonicalTag(instrument.connectedTo) : '';
    if (observed.has(source) && observed.get(source) !== target) {
      throw new Error('Conflicting extracted signal connection for ' + source + '.');
    }
    observed.set(source, target);
  }

  const actualEdges = new Set<string>();
  for (const [source, target] of observed) {
    if (target) actualEdges.add(key(source, target));
  }

  const missed = [...expectedEdges].filter(edge => !actualEdges.has(edge)).map(display).sort();
  const unexpected = [...actualEdges].filter(edge => !expectedEdges.has(edge)).map(display).sort();

  return {
    expected: expectedEdges.size,
    extracted: actualEdges.size,
    matched: expectedEdges.size - missed.length,
    missed,
    unexpected,
  };
}

/** Microaverage across labelled drawings only; 0/0 is reported as 0, not success. */
export function summarizeTopology(scores: TopologyScore[]): TopologySummary {
  const expected = scores.reduce((s, score) => s + score.expected, 0);
  const extracted = scores.reduce((s, score) => s + score.extracted, 0);
  const matched = scores.reduce((s, score) => s + score.matched, 0);
  const precision = ratio(matched, extracted);
  const recall = ratio(matched, expected);
  return { precision, recall, f1: ratio(2 * precision * recall, precision + recall) };
}
