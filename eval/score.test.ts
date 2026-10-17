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

  it('rejects contradicting duplicate extracted tags instead of letting order set type accuracy', () => {
    const expected = [{ tagName: 'PT-101', signalType: 'AI', pcs7BlockType: 'MonAnL' }];
    const ambiguous = [
      actual('pt101', 'AI', 'MonAnL'),
      actual('PT-101', 'AO', 'PIDConL'),
    ];
    expect(() => scoreSample(expected, ambiguous)).toThrow('Conflicting extracted instrument tag: PT-101');
    expect(() => scoreSample(expected, [...ambiguous].reverse())).toThrow('Conflicting extracted instrument tag: PT-101');
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

describe('canonical expected-tag uniqueness', () => {
  it('rejects duplicate names that differ only by case, spacing or a hyphen', () => {
    expect(() => scoreSample(
      [{ tagName: 'PT-101' }, { tagName: 'pt101', signalType: 'AO' }],
      [actual('PT-101')],
    )).toThrow('Duplicate expected instrument tag: PT-101');
  });

  it('does not silently choose between conflicting expected classifications', () => {
    expect(() => scoreSample(
      [
        { tagName: 'FT 101A', signalType: 'AI', pcs7BlockType: 'MonAnL' },
        { tagName: 'ft-101a', signalType: 'AO', pcs7BlockType: 'PIDConL' },
      ],
      [actual('FT-101A')],
    )).toThrow('Duplicate expected instrument tag: FT-101A');
  });

  it('treats different instrument functions and loop numbers as distinct', () => {
    const result = scoreSample(
      [{ tagName: 'FT-101' }, { tagName: 'FCV-101' }, { tagName: 'FT-102' }],
      [actual('FT101'), actual('FCV101')],
    );
    expect(result.expected).toBe(3);
    expect(result.extracted).toBe(2);
    expect(result.matched).toBe(2);
    expect(result.missed).toEqual(['FT-102']);
    expect(summarize([result]).precision).toBe(1);
    expect(summarize([result]).recall).toBeCloseTo(2 / 3);
  });

  it('keeps all summary rates bounded on zero, perfect and imperfect samples', () => {
    const samples = [
      scoreSample([], []),
      scoreSample([{ tagName: 'PT-201', signalType: 'AI' }], [actual('PT201')]),
      scoreSample(
        [{ tagName: 'TT-301', signalType: 'AI' }, { tagName: 'TT-302', signalType: 'DI' }],
        [actual('TT301', 'AO'), actual('FT-999')],
      ),
    ];

    for (const scores of [[], ...samples.map(s => [s]), samples]) {
      const summary = summarize(scores);
      for (const rate of Object.values(summary)) {
        expect(Number.isFinite(rate)).toBe(true);
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    }
  });

  it('continues to count repeated extracted tags once without changing expectations', () => {
    const result = scoreSample(
      [{ tagName: 'PT-101', signalType: 'AI' }],
      [actual('PT-101'), actual('pt101')],
    );
    expect(result).toMatchObject({
      expected: 1,
      extracted: 1,
      matched: 1,
      signalCorrect: 1,
    });
  });
});
