import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Instrument } from '../types';
import AuditBOM from './AuditBOM';

const inst = (tagName: string, estimatedCost?: number): Instrument => ({
  id: tagName,
  tagName,
  equipmentType: 'Transmitter',
  signalType: 'AI',
  description: 'Synthetic measurement',
  engineeringUnits: 'bar',
  pcs7BlockType: 'MonAnL',
  abb800xaObject: 'Signal_Object',
  confidence: 'low',
  estimatedCost,
});

describe('BOM rendering of unverified estimates', () => {
  it('labels missing and invalid equipment estimates instead of showing fictitious zeroes', () => {
    const html = renderToStaticMarkup(<AuditBOM instruments={[
      inst('PT-101', 250),
      inst('TT-102', -100),
      inst('LT-103'),
      inst('FT-104', Number.NaN),
    ]} />);
    expect(html).toContain('USD 250');
    expect(html).toContain('Partial estimate:');
    expect(html).toContain('3 unpriced item(s)');
    expect(html).toContain('Not estimated');
    expect(html).not.toContain('USD -100');
  });

  it('distinguishes a genuine zero-price estimate from an absent price', () => {
    const zero = renderToStaticMarkup(<AuditBOM instruments={[inst('PT-101', 0)]} />);
    expect(zero).toContain('USD 0');
    expect(zero).not.toContain('Partial estimate:');
    const missing = renderToStaticMarkup(<AuditBOM instruments={[inst('PT-101')]} />);
    expect(missing).toContain('Not estimated');
    expect(missing).toContain('Partial estimate: 1 unpriced item(s)');
  });

  it('never treats lack of safety-warning strings as certified plant safety', () => {
    const html = renderToStaticMarkup(<AuditBOM instruments={[]} />);
    expect(html).toContain('not a certified safety or standards audit');
  });
});
