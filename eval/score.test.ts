import { describe, expect, it } from 'vitest';
import { canonicalTag, scoreSample, summarize } from './score';

const actual = (tagName: string, signalType = 'AI', pcs7BlockType = 'MonAnL') => ({ tagName, signalType, pcs7BlockType });

describe('canonicalTag', () => {
  it('treats spacing, hyphens and case as equivalent', () => {
    expect(canonicalTag('ft101')).toBe('FT-101');
    expect(canonicalTag('FT 101A')).toBe('FT-101A');
    expect(canonicalTag(' pump ')).toBe('PUMP');
  });
});

describe('scoreSample', () => {
  it('counts matches, misses, extras and type agreement', () => {
    const score = scoreSample(
      [
        { tagName: 'FT-101', signalType: 'AI', pcs7BlockType: 'MonAnL' },
        { tagName: 'FIC-101', signalType: ['AI', 'AO'], pcs7BlockType: 'PIDConL' },
        { tagName: 'FCV-101', signalType: 'AO', pcs7BlockType: 'VlvAnL' },
      ],
      [actual('ft101'), actual('FIC-101', 'AO', 'PIDConL'), actual('PI-999')],
    );
    expect(score).toEqual({
      expected: 3,
      extracted: 3,
      matched: 2,
      missed: ['FCV-101'],
      unexpected: ['PI-999'],
      signalCorrect: 2,
      blockCorrect: 2,
    });
  });

  it('counts a duplicated extraction once', () => {
    expect(scoreSample([{ tagName: 'PT-1' }], [actual('PT-1'), actual('PT 1')]).extracted).toBe(1);
  });
});

describe('summarize', () => {
  it('micro-averages precision, recall and type accuracy', () => {
    const summary = summarize([
      { expected: 4, extracted: 2, matched: 2, missed: [], unexpected: [], signalCorrect: 2, blockCorrect: 1 },
      { expected: 2, extracted: 4, matched: 2, missed: [], unexpected: [], signalCorrect: 1, blockCorrect: 2 },
    ]);
    expect(summary.precision).toBeCloseTo(4 / 6);
    expect(summary.recall).toBeCloseTo(4 / 6);
    expect(summary.f1).toBeCloseTo(4 / 6);
    expect(summary.signalAccuracy).toBeCloseTo(3 / 4);
    expect(summary.blockAccuracy).toBeCloseTo(3 / 4);
  });

  it('returns zeros instead of NaN when nothing was extracted', () => {
    expect(summarize([{ expected: 3, extracted: 0, matched: 0, missed: [], unexpected: [], signalCorrect: 0, blockCorrect: 0 }]))
      .toEqual({ precision: 0, recall: 0, f1: 0, signalAccuracy: 0, blockAccuracy: 0 });
  });
});
