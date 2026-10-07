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
