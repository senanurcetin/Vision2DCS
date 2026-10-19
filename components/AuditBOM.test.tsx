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

  it('shows duplicate tag and naming audit findings even without model safety-warning strings', () => {
    const html = renderToStaticMarkup(<AuditBOM instruments={[
      inst('PT-101'), { ...inst('PT-102'), tagName: 'pt101' },
      inst('NOT-VALID/TAG'),
    ]} />);
    expect(html).toContain('Duplicate instrument tag PT-101');
    expect(html).toContain('Non-standard ISA-5.1 naming');
    expect(html).not.toContain('No findings from the limited tag/loop checks');
  });

  it('distinguishes unverified model safety notes from deterministic audit findings', () => {
    const html = renderToStaticMarkup(<AuditBOM instruments={[
      { ...inst('PT-101'), safetyWarning: 'Review pressure sensor placement' },
    ]} />);
    expect(html).toContain('Unverified model safety note');
    expect(html).toContain('Review pressure sensor placement');
    expect(html).not.toContain('certified approval');
  });

  it('never treats lack of safety-warning strings as certified plant safety', () => {
    const html = renderToStaticMarkup(<AuditBOM instruments={[]} />);
    expect(html).toContain('not a certified safety or standards audit');
  });
});
