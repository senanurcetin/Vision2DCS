import { parseTag } from '../services/tagParser';

export interface ExpectedInstrument {
  tagName: string;
  /** One value, or every value an engineer would accept (e.g. a controller as AI or AO). */
  signalType?: string | string[];
  pcs7BlockType?: string | string[];
}

export interface SampleScore {
  expected: number;
  extracted: number;
  matched: number;
  missed: string[];
  unexpected: string[];
  signalCorrect: number;
  blockCorrect: number;
}

/** "ft101", "FT 101" and "FT-101" are the same tag. */
export const canonicalTag = (tagName: string): string => {
  const parsed = parseTag(tagName);
  return parsed
    ? `${parsed.functionLetters}-${parsed.loopNumber}${parsed.suffix}`
    : tagName.trim().toUpperCase();
};

const accepts = (expected: string | string[] | undefined, actual: string) =>
  expected === undefined || (Array.isArray(expected) ? expected.includes(actual) : expected === actual);

export interface ExtractedInstrument {
  tagName: string;
  signalType: string;
  pcs7BlockType: string;
}

export const scoreSample = (expected: ExpectedInstrument[], actual: ExtractedInstrument[]): SampleScore => {
  const actualByTag = new Map(actual.map(a => [canonicalTag(a.tagName), a]));
  const expectedTags = new Set(expected.map(e => canonicalTag(e.tagName)));

  let signalCorrect = 0;
  let blockCorrect = 0;
  const missed: string[] = [];
  expected.forEach(e => {
    const found = actualByTag.get(canonicalTag(e.tagName));
    if (!found) {
      missed.push(e.tagName);
      return;
    }
    if (accepts(e.signalType, found.signalType)) signalCorrect++;
    if (accepts(e.pcs7BlockType, found.pcs7BlockType)) blockCorrect++;
  });

  return {
    expected: expected.length,
    extracted: actualByTag.size,
    matched: expected.length - missed.length,
    missed,
    unexpected: [...actualByTag.keys()].filter(tag => !expectedTags.has(tag)),
    signalCorrect,
    blockCorrect,
  };
};

export interface Summary {
  precision: number;
  recall: number;
  f1: number;
  signalAccuracy: number;
  blockAccuracy: number;
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

/** Micro-averaged over all samples; type accuracy is measured on matched tags only. */
export const summarize = (scores: SampleScore[]): Summary => {
  const total = (key: 'expected' | 'extracted' | 'matched' | 'signalCorrect' | 'blockCorrect') =>
    scores.reduce((sum, s) => sum + s[key], 0);
  const precision = ratio(total('matched'), total('extracted'));
  const recall = ratio(total('matched'), total('expected'));
  return {
    precision,
    recall,
    f1: ratio(2 * precision * recall, precision + recall),
    signalAccuracy: ratio(total('signalCorrect'), total('matched')),
    blockAccuracy: ratio(total('blockCorrect'), total('matched')),
  };
};
