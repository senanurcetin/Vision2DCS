import { describe, expect, it } from 'vitest';
import { normalizeInstrument, parseInstrumentResponse } from './normalizeInstruments';

describe('normalizeInstrument', () => {
  it('keeps valid model output', () => {
    const inst = normalizeInstrument({
      tagName: 'ft-101',
      equipmentType: 'Transmitter',
      signalType: 'AI',
      description: 'Feed flow',
      engineeringUnits: 'm3/h',
      pcs7BlockType: 'MonAnL',
      abb800xaObject: 'AI_Object',
      confidence: 'high',
      estimatedCost: 1200,
    }, 0, 'test');

    expect(inst).toMatchObject({
      id: 'test-0',
      tagName: 'FT-101',
      signalType: 'AI',
      pcs7BlockType: 'MonAnL',
      engineeringUnits: 'm3/h',
      confidence: 'high',
      estimatedCost: 1200,
    });
  });

  it('marks unrecognised signal and block types as Unknown with low confidence', () => {
    const inst = normalizeInstrument({ tagName: 'XY-1', signalType: 'HART', pcs7BlockType: 'Foo', confidence: 'high' }, 0, 'p');
    expect(inst.signalType).toBe('Unknown');
    expect(inst.pcs7BlockType).toBe('Unknown');
    expect(inst.confidence).toBe('low');
  });

  it('defaults a missing confidence to low rather than leaving it undefined', () => {
    const inst = normalizeInstrument({ tagName: 'PT-1', signalType: 'AI', pcs7BlockType: 'MonAnL' }, 0, 'p');
    expect(inst.confidence).toBe('low');
  });

  it('fills a missing tag name and leaves missing units empty', () => {
    const inst = normalizeInstrument({}, 3, 'p');
    expect(inst.tagName).toBe('TAG-103');
    expect(inst.engineeringUnits).toBe('');
  });

  it('drops non-numeric costs', () => {
    expect(normalizeInstrument({ estimatedCost: '1200' }, 0, 'p').estimatedCost).toBeUndefined();
    expect(normalizeInstrument({ estimatedCost: Number.NaN }, 0, 'p').estimatedCost).toBeUndefined();
  });
});

describe('parseInstrumentResponse', () => {
  it('parses a JSON array and assigns sequential ids', () => {
    const result = parseInstrumentResponse(JSON.stringify([{ tagName: 'PT-1' }, { tagName: 'TT-2' }]), 'run');
    expect(result.map(i => i.id)).toEqual(['run-0', 'run-1']);
  });

  it('skips entries that are not objects', () => {
    const result = parseInstrumentResponse(JSON.stringify([null, 'PT-1', [], { tagName: 'PT-2' }]), 'run');
    expect(result.map(i => i.tagName)).toEqual(['PT-2']);
  });

  it('rejects empty, malformed and non-array responses', () => {
    expect(() => parseInstrumentResponse(undefined, 'run')).toThrow('No data returned from AI');
    expect(() => parseInstrumentResponse('{not json', 'run')).toThrow('malformed JSON');
    expect(() => parseInstrumentResponse('{"tagName":"PT-1"}', 'run')).toThrow('not a list');
  });
});
