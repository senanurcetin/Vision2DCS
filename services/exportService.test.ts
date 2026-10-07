// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Instrument } from '../types';
import { buildAbbXml, buildSiemensCsv, escapeCsvField, escapeXml } from './exportService';

const inst = (overrides: Partial<Instrument>): Instrument => ({
  id: 'id',
  tagName: 'PT-101',
  equipmentType: 'Transmitter',
  signalType: 'AI',
  description: 'Pressure measurement',
  engineeringUnits: 'barg',
  pcs7BlockType: 'MonAnL',
  abb800xaObject: 'AI_Object',
  confidence: 'high',
  ...overrides,
});

const tricky = inst({
  tagName: 'TT-102',
  description: 'Reactor "A" temp; inlet <hot> & \'dry\'\nsecond line',
  engineeringUnits: '°C',
  abb800xaObject: 'AI<Temp>',
});

/** Minimal RFC 4180 reader for a semicolon-delimited document. */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += c;
  }
  return rows;
};

describe('escapeXml', () => {
  it('escapes markup characters and drops invalid control characters', () => {
    expect(escapeXml(`a&b<c>"d"'e'\u0001`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
  });
});

describe('escapeCsvField', () => {
  it('leaves plain values alone', () => {
    expect(escapeCsvField('PT-101')).toBe('PT-101');
  });

  it('quotes values with delimiters, quotes or newlines', () => {
    expect(escapeCsvField('a;b')).toBe('"a;b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
  });
});

describe('buildSiemensCsv', () => {
  it('writes a header and one row per instrument', () => {
    expect(buildSiemensCsv([inst({})])).toBe(
      'Tag Name;Description;Block Type;Signal Type;Engineering Units\r\n' +
      'PT-101;Pressure measurement;MonAnL;AI;barg\r\n'
    );
  });

  it('round-trips special characters through a CSV reader', () => {
    const rows = parseCsv(buildSiemensCsv([tricky, inst({ tagName: 'XY-1', engineeringUnits: '' })]));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(['TT-102', tricky.description, 'MonAnL', 'AI', '°C']);
    expect(rows[2]).toEqual(['XY-1', 'Pressure measurement', 'MonAnL', 'AI', '']);
  });
});

describe('buildAbbXml', () => {
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

  it('produces well-formed XML that preserves the original values', () => {
    const doc = parse(buildAbbXml([inst({}), tricky]));
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);

    const objects = Array.from(doc.getElementsByTagName('Object'));
    expect(objects.map(o => o.getAttribute('Name'))).toEqual(['PT-101', 'TT-102']);
    expect(objects[1].getAttribute('Type')).toBe('AI<Temp>');

    const props = Object.fromEntries(
      Array.from(objects[1].getElementsByTagName('Property')).map(p => [p.getAttribute('Name'), p.textContent])
    );
    expect(props).toEqual({
      Description: tricky.description,
      SignalType: 'AI',
      EngUnits: '°C',
      PCS7BlockMapping: 'MonAnL',
    });
  });

  it('is well-formed for an empty instrument list', () => {
    expect(parse(buildAbbXml([])).getElementsByTagName('parsererror')).toHaveLength(0);
  });
});
