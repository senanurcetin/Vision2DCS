import { describe, expect, it } from 'vitest';
import { OCR_BASELINE_METHOD, parseOcrInstrumentTags } from './ocrBaseline';

describe('actual-OCR-text ISA tag baseline parser', () => {
  it('canonicalizes case, split OCR separators and preserves full boundaries', () => {
    expect(parseOcrInstrumentTags('ft101  FIC-101\nFCV 101A\nPT-202, TT-303.'))
      .toEqual(['FCV-101A', 'FIC-101', 'FT-101', 'PT-202', 'TT-303']);
    expect(OCR_BASELINE_METHOD).toContain('tags only');
  });

  it('deduplicates repeated readings and rejects part numbers, dates, oversized tags', () => {
    expect(parseOcrInstrumentTags(
      'ft-101 FT101 XFT-101A9 randomFIC-101XYZ 2026-10-21 ABCDE-101 FT-123456 PM-1'
    )).toEqual(['FT-101']);
  });

  it('does not turn expected labels, network commands or downstream guesses into OCR', () => {
    expect(parseOcrInstrumentTags('No recognized instrument tags in this OCR text.')).toEqual([]);
    expect(parseOcrInstrumentTags('FIC-101\nFIC-101')).toEqual(['FIC-101']);
  });

  it('caps arbitrary untrusted OCR output before extracting candidates', () => {
    expect(() => parseOcrInstrumentTags('x'.repeat(256 * 1024 + 1))).toThrow(/256 KiB/);
    expect(() => parseOcrInstrumentTags(null as never)).toThrow(/string/);
    const large = Array.from({ length: 2002 }, (_, i) => 'PT-' + String(i + 100).padStart(4, '0')).join(' ');
    expect(() => parseOcrInstrumentTags(large)).toThrow(/Too many/);
  });
});
