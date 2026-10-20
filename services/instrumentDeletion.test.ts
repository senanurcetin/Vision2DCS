import { describe, expect, it } from 'vitest';
import type { Instrument } from '../types';
import { instrumentDeletionWarning } from './instrumentDeletion';

const inst = (id: string, tagName: string, connectedTo?: string): Instrument => ({
  id, tagName, connectedTo,
  description: '', equipmentType: '', signalType: 'AI', engineeringUnits: 'bar',
  pcs7BlockType: 'MonAnL', abb800xaObject: '', confidence: 'low',
});

describe('explicit deletion consent evidence', () => {
  it('warns about canonical incoming declared link references without mutating rows', () => {
    const rows = [
      inst('a', 'PT-101'),
      inst('b', 'TT-102', 'pt101'),
      inst('c', 'LT-103', 'PT-101'),
      inst('d', 'FT-104', 'other'),
    ];
    const before = structuredClone(rows);
    expect(instrumentDeletionWarning(rows, 'a')).toContain('2 other declared signal connection(s)');
    expect(instrumentDeletionWarning(rows, 'a')).toContain('remain');
    expect(rows).toEqual(before);
  });
  it('does not invent links, and returns null for missing targets', () => {
    const rows = [inst('one', 'FT-101')];
    expect(instrumentDeletionWarning(rows, 'one')).toContain('Undo is available');
    expect(instrumentDeletionWarning(rows, 'missing')).toBeNull();
  });
});
