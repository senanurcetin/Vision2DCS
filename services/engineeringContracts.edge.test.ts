import { describe, expect, it } from 'vitest';
import {
  ISA_NAMING_PATTERN,
  getLoopKey,
  isValveTag,
  parseTag,
} from './tagParser';
import {
  ModelOutputError,
  normalizeInstrument,
  parseInstrumentResponse,
} from './normalizeInstruments';
import { buildAbbXml, buildSiemensCsv, escapeCsvField, escapeXml } from './exportService';

describe('ISA tag naming and control-loop contract', () => {
  it.each([
    ['FT-101', 'F-101'],
    ['FCV-101A', 'F-101'],
    ['FIC 101B', 'F-101'],
    ['pt001', 'P-001'],
    ['TT-101', 'T-101'],
  ])('%s belongs to loop %s', (tag, loop) => {
    expect(getLoopKey(tag)).toBe(loop);
  });

  it('keeps distinct loop numbers and measured variables separate', () => {
    expect(getLoopKey('FT-101')).not.toBe(getLoopKey('FT-102'));
    expect(getLoopKey('FT-101')).not.toBe(getLoopKey('PT-101'));
    expect(getLoopKey('FCV-101A')).toBe(getLoopKey('FT-101B'));
  });

  it.each(['PT-01', 'FCV-1001A', 'TT-99999'])(
    'accepts %s under the strict audit naming convention',
    (tag) => {
      expect(ISA_NAMING_PATTERN.test(tag)).toBe(true);
    },
  );

  it.each(['P-1', 'FCV 101', 'ABCDEF-101', 'PT-123456', 'pt-101', 'PT-101AB'])(
    'rejects %s under strict naming even if permissive parsing might allow it',
    (tag) => {
      expect(ISA_NAMING_PATTERN.test(tag)).toBe(false);
    },
  );

  it.each(['FCV-101A', 'XV 22', 'fv003'])(
    'detects %s as a final valve element',
    (tag) => {
      expect(isValveTag(tag)).toBe(true);
    },
  );

  it.each(['V-101', 'FT-101', 'VC101P', 'NOT-A-TAG', ''])(
    'does not confuse %s with a valve',
    (tag) => {
      expect(isValveTag(tag)).toBe(false);
    },
  );

  it('parses loop suffixes but does not treat them as separate loop numbers', () => {
    expect(parseTag(' fcv-0101ab ')).toEqual({
      functionLetters: 'FCV',
      loopNumber: '0101',
      suffix: 'AB',
    });
    expect(getLoopKey('FCV-0101AB')).toBe('F-0101');
  });
});

describe('model-output normalization must not conceal uncertainty', () => {
  it.each(['Unknown', 'ai', 'AI ', '', null, 42])(
    'rejects invalid signal type %s rather than guessing a plausible one',
    (signalType) => {
      const instrument = normalizeInstrument(
        { tagName: 'FT-101', signalType, pcs7BlockType: 'MonAnL', confidence: 'high' },
        0,
        'audit',
      );
      expect(instrument.signalType).toBe('Unknown');
      expect(instrument.confidence).toBe('low');
    },
  );

  it('retains an explicit medium confidence only for valid mappings', () => {
    const instrument = normalizeInstrument(
      { tagName: 'FCV-101', signalType: 'AO', pcs7BlockType: 'VlvAnL', confidence: 'medium' },
      2,
      'audit',
    );
    expect(instrument.id).toBe('audit-2');
    expect(instrument.confidence).toBe('medium');
    expect(instrument.signalType).toBe('AO');
    expect(instrument.pcs7BlockType).toBe('VlvAnL');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '500'])(
    'rejects non-finite or non-numeric model cost %s',
    (estimatedCost) => {
      expect(normalizeInstrument({ estimatedCost }, 1, 'audit').estimatedCost).toBeUndefined();
    },
  );

  it('preserves zero-cost explicitly and trims descriptive fields', () => {
    const instrument = normalizeInstrument(
      { tagName: '  tt-22 ', description: ' reactor inlet ', estimatedCost: 0 },
      1,
      'audit',
    );
    expect(instrument.tagName).toBe('TT-22');
    expect(instrument.description).toBe('reactor inlet');
    expect(instrument.estimatedCost).toBe(0);
  });

  it('fails closed on mixed model responses that would omit engineering rows', () => {
    const raw = JSON.stringify([
      null,
      { tagName: 'FT-1', signalType: 'AI', pcs7BlockType: 'MonAnL' },
      42,
      ['not an instrument'],
      { tagName: 'PT-2', signalType: 'AI', pcs7BlockType: 'MonAnL' },
    ]);
    expect(() => parseInstrumentResponse(raw, 'run')).toThrow(ModelOutputError);
    expect(() => parseInstrumentResponse(raw, 'run'))
      .toThrow('invalid instrument row at index 0');
  });

  it('rejects syntactically valid non-list JSON with a domain error', () => {
    for (const raw of ['null', 'false', '123', '{"tagName":"FT-1"}']) {
      expect(() => parseInstrumentResponse(raw, 'run')).toThrow(ModelOutputError);
    }
  });

  it('accepts an empty model list without inventing equipment', () => {
    expect(parseInstrumentResponse('[]', 'run')).toEqual([]);
  });
});

describe('PLC/DCS export format boundaries', () => {
  it('preserves empty output schemas for both vendors', () => {
    expect(buildSiemensCsv([])).toBe(
      'Tag Name;Description;Block Type;Signal Type;Engineering Units\r\n',
    );
    expect(buildAbbXml([])).toContain('<ABB_800xA_Import version="1.0">');
  });

  it('quotes semicolon, quote, LF, and CR characters under Siemens format', () => {
    expect(escapeCsvField('a;b')).toBe('"a;b"');
    expect(escapeCsvField('a"b')).toBe('"a""b"');
    expect(escapeCsvField('a\nb')).toBe('"a\nb"');
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
    expect(escapeCsvField('AI')).toBe('AI');
  });

  it('escapes XML metacharacters without altering standard whitespace', () => {
    expect(escapeXml('a&b<c>d"e\'f')).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
    expect(escapeXml('line1\nline2\tname')).toBe('line1\nline2\tname');
    expect(escapeXml('hello\u0001world')).toBe('helloworld');
  });
});
