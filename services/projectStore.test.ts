// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { AnalysisProject } from '../types';
import { loadProjects, saveProjects, STORAGE_KEY } from './projectStore';

const project = (id: string): AnalysisProject => ({ id, name: id, date: 'today', imageUrl: '', instruments: [] });

const memoryStorage = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
};

describe('loadProjects', () => {
  it('returns saved projects', () => {
    expect(loadProjects(memoryStorage(JSON.stringify([project('a')])))).toEqual([project('a')]);
  });

  it('returns nothing for missing, corrupt or non-list data', () => {
    expect(loadProjects(undefined)).toEqual([]);
    expect(loadProjects(memoryStorage())).toEqual([]);
    expect(loadProjects(memoryStorage('{oops'))).toEqual([]);
    expect(loadProjects(memoryStorage('{"id":"a"}'))).toEqual([]);
  });

  it('skips malformed entries', () => {
    const raw = JSON.stringify([project('a'), { id: 'b' }, null, 'x']);
    expect(loadProjects(memoryStorage(raw)).map(p => p.id)).toEqual(['a']);
  });


  it('rejects malformed stored instrument rows without hiding damage inside a valid project', () => {
    const healthy = project('healthy');
    const instrument = {
      id: 'i1', tagName: 'PT-101', equipmentType: 'Transmitter', signalType: 'AI',
      description: 'Pressure', engineeringUnits: 'barg', pcs7BlockType: 'MonAnL',
      abb800xaObject: 'AI_Object', confidence: 'high', reviewed: true,
    };
    for (const invalid of [null, 5, [], { ...instrument, signalType: 42 },
      { ...instrument, description: null }, { ...instrument, connectedTo: ['PT-102'] }]) {
      const corrupted = { ...project('corrupt'), instruments: [instrument, invalid] };
      const saved = JSON.stringify([corrupted, healthy]);
      expect(loadProjects(memoryStorage(saved))).toEqual([healthy]);
    }
  });

  it('preserves valid locally reviewed instruments and rejects duplicate instrument IDs', () => {
    const row = {
      id: 'sensor', tagName: 'PT-101', equipmentType: 'Transmitter', signalType: 'AI',
      description: 'Pressure', engineeringUnits: 'barg', pcs7BlockType: 'MonAnL',
      abb800xaObject: 'AI_Object', confidence: 'high', reviewed: true,
    };
    const valid = { ...project('checked'), instruments: [row] };
    expect(loadProjects(memoryStorage(JSON.stringify([valid])))[0].instruments[0].reviewed).toBe(true);
    const corrupt = { ...valid, instruments: [row, { ...row, tagName: 'PT-102' }] };
    expect(loadProjects(memoryStorage(JSON.stringify([corrupt])))).toEqual([]);
  });

  it('removes unsafe image URLs from browser storage while preserving instrument data', () => {
    const stored = {
      ...project('plant'),
      imageUrl: 'https://example.invalid/plant.svg',
      digitalTwinUrl: 'javascript:alert(1)',
    };
    expect(loadProjects(memoryStorage(JSON.stringify([stored])))).toEqual([
      { ...project('plant'), imageUrl: '' },
    ]);
    const valid = { ...project('local'), imageUrl: 'data:image/png;base64,AAAA',
      digitalTwinUrl: 'data:image/webp;base64,AQID' };
    expect(loadProjects(memoryStorage(JSON.stringify([valid])))).toEqual([valid]);
    const svg = { ...project('svg'), imageUrl: 'data:image/svg+xml;base64,AAAA' };
    expect(loadProjects(memoryStorage(JSON.stringify([svg])))[0].imageUrl).toBe('');
  });

  it('skips duplicate project IDs, oversized arrays and malformed metadata', () => {
    const healthy = project('healthy');
    const repeated = { ...project('oversized'), instruments: Array(2001).fill(null) };
    const badDate = { ...project('bad-date'), date: 2026 };
    expect(loadProjects(memoryStorage(JSON.stringify([
      healthy, { ...healthy, name: 'duplicate' }, repeated, badDate, project('other'),
    ]))).map(p => p.id)).toEqual(['healthy', 'other']);
  });

  it('survives storage that throws on read', () => {
    expect(loadProjects({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toEqual([]);
  });
});

describe('saveProjects', () => {
  it('writes projects that load back unchanged', () => {
    const storage = memoryStorage();
    expect(saveProjects(storage, [project('a')])).toEqual({ ok: true });
    expect(loadProjects(storage)).toEqual([project('a')]);
  });

  it('reports a full quota instead of throwing', () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(saveProjects(full, [project('a')])).toEqual({ ok: false, reason: 'quota' });
  });

  it('reports missing or broken storage as unavailable', () => {
    expect(saveProjects(undefined, [])).toEqual({ ok: false, reason: 'unavailable' });
    const broken = { getItem: () => null, setItem: () => { throw new Error('SecurityError'); } };
    expect(saveProjects(broken, [])).toEqual({ ok: false, reason: 'unavailable' });
  });
});
