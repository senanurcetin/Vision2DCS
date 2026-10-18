import { describe, expect, it } from 'vitest';
import type { AnalysisProject, Instrument } from '../types';
import { type ProjectState, projectReducer } from './useProjects';

const instrument = (tagName: string, reviewed = false): Instrument => ({
  id: 'inst', tagName, equipmentType: 'Transmitter', signalType: 'AI',
  description: 'Pressure', engineeringUnits: 'barg', pcs7BlockType: 'MonAnL',
  abb800xaObject: 'AI_Object', confidence: 'high', reviewed,
});
const project = (id: string, tagName: string): AnalysisProject => ({
  id, name: id, date: 'today', imageUrl: '', instruments: [instrument(tagName)],
});
const state = (): ProjectState => ({ projects: [project('a', 'PT-101'), project('b', 'TT-201')], currentId: 'a', histories: {} });

describe('project reducer engineering history', () => {
  it('undoes and redoes only the selected project without touching another project', () => {
    const initial = state();
    const edited = projectReducer(initial, { type: 'edit-instruments', id: 'a',
      change: rows => rows.map(r => ({ ...r, tagName: 'PT-102' })) });
    expect(edited.projects[0].instruments[0].tagName).toBe('PT-102');
    expect(edited.projects[1]).toBe(initial.projects[1]);
    const undone = projectReducer(edited, { type: 'undo', id: 'a' });
    expect(undone.projects[0].instruments[0].tagName).toBe('PT-101');
    expect(undone.histories.a.future).toHaveLength(1);
    const redone = projectReducer(undone, { type: 'redo', id: 'a' });
    expect(redone.projects[0].instruments[0].tagName).toBe('PT-102');
    expect(redone.histories.a.future).toHaveLength(0);
  });

  it('invalidates restored approvals; switching, deleting or importing do not leak old stacks', () => {
    const initial = state();
    initial.projects[0].instruments[0].reviewed = true;
    const edited = projectReducer(initial, { type: 'edit-instruments', id: 'a',
      change: rows => rows.map(r => ({ ...r, tagName: 'PT-102', reviewed: false })) });
    const reverted = projectReducer(edited, { type: 'undo', id: 'a' });
    expect(reverted.projects[0].instruments[0]).toMatchObject({ tagName: 'PT-101', reviewed: false });
    expect(projectReducer(reverted, { type: 'select', id: 'b' }).histories.a.past).toEqual([]);
    const removed = projectReducer(reverted, { type: 'remove', id: 'a' });
    expect(removed.histories.a).toBeUndefined();
    expect(removed.currentId).toBeNull();
    const imported = projectReducer(reverted, { type: 'add', project: project('a', 'PT-900') });
    expect(imported.histories.a).toBeUndefined();
    expect(imported.projects[0].instruments[0].tagName).toBe('PT-900');
  });

  it('does not record history for a drawing-only update or a missing project', () => {
    const original = state();
    const updated = projectReducer(original, { type: 'update', id: 'a',
      update: p => ({ ...p, digitalTwinUrl: 'data:image/png;base64,AAAA' }) });
    expect(updated.histories).toEqual({});
    expect(projectReducer(updated, { type: 'undo', id: 'a' })).toBe(updated);
    expect(projectReducer(updated, { type: 'redo', id: 'nonexistent' })).toBe(updated);
  });
});
