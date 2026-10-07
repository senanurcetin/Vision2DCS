import { describe, expect, it } from 'vitest';
import { getLoopKey, isValveTag, parseTag } from './tagParser';

describe('parseTag', () => {
  it('splits function letters, loop number and suffix', () => {
    expect(parseTag('FCV-101A')).toEqual({ functionLetters: 'FCV', loopNumber: '101', suffix: 'A' });
  });

  it('accepts tags without a hyphen and normalises case', () => {
    expect(parseTag(' pt101 ')).toEqual({ functionLetters: 'PT', loopNumber: '101', suffix: '' });
  });

  it('returns null for text that is not a tag', () => {
    expect(parseTag('PUMP')).toBeNull();
    expect(parseTag('101')).toBeNull();
  });
});

describe('getLoopKey', () => {
  it('groups instruments of the same measured variable and number', () => {
    expect(getLoopKey('FT-101')).toBe('F-101');
    expect(getLoopKey('FCV-101')).toBe('F-101');
    expect(getLoopKey('PT-101A')).toBe('P-101');
  });

  it('keeps loops of different variables apart even with the same number', () => {
    expect(getLoopKey('PT-101')).not.toBe(getLoopKey('TT-101'));
  });

  it('returns null for unparseable tags', () => {
    expect(getLoopKey('TAG')).toBeNull();
  });
});

describe('isValveTag', () => {
  it.each(['FV-101', 'FCV-101', 'XV-200', 'PCV-12'])('%s is a valve', tag => {
    expect(isValveTag(tag)).toBe(true);
  });

  it.each(['FT-101', 'V-101', 'LIT-5', 'PUMP'])('%s is not a valve', tag => {
    expect(isValveTag(tag)).toBe(false);
  });
});
