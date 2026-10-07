import { describe, expect, it } from 'vitest';
import { AnalysisProject, Instrument } from '../types';
import { parseProjectBackup, serializeProject } from './projectBackup';

const instrument: Instrument = {
  id: 'i1', tagName: 'PT-101', equipmentType: 'Transmitter', signalType: 'AI', description: 'Pressure',
  engineeringUnits: 'barg', pcs7BlockType: 'MonAnL', abb800xaObject: 'AI', confidence: 'high', estimatedCost: 900,
};

const project: AnalysisProject = {
  id: 'proj-1', name: 'Feed line', date: '2026-10-07', imageUrl: 'data:image/png;base64,AAAA',
  instruments: [instrument], digitalTwinUrl: 'data:image/png;base64,BBBB',
};

describe('project backup', () => {
  it('round-trips a project under a new id', () => {
    const restored = parseProjectBackup(serializeProject(project), 'proj-2');
    expect(restored).toMatchObject({ ...project, id: 'proj-2', instruments: [{ ...instrument, id: 'proj-2-inst-0' }] });
  });

  it('rejects files that are not Vision2DCS backups', () => {
    expect(() => parseProjectBackup('{oops', 'x')).toThrow('not valid JSON');
    expect(() => parseProjectBackup('{"format":"other"}', 'x')).toThrow('not a Vision2DCS project backup');
    expect(() => parseProjectBackup('{"format":"vision2dcs-project","version":9,"project":{}}', 'x')).toThrow('Unsupported backup version');
    expect(() => parseProjectBackup('{"format":"vision2dcs-project","version":1,"project":{"id":"a"}}', 'x')).toThrow('valid project');
  });

  it('drops image URLs that are not inline images', () => {
    const hostile = { ...project, imageUrl: 'https://evil.example/x.png', digitalTwinUrl: 'javascript:alert(1)' };
    const restored = parseProjectBackup(serializeProject(hostile), 'p');
    expect(restored.imageUrl).toBe('');
    expect(restored).not.toHaveProperty('digitalTwinUrl');
  });

  it('re-normalizes instruments and skips entries that are not objects', () => {
    const tampered = JSON.stringify({
      format: 'vision2dcs-project', version: 1,
      project: { ...project, instruments: [{ tagName: 'xy-1', signalType: 'HART', confidence: 'high' }, 'junk', null] },
    });
    const [only, ...rest] = parseProjectBackup(tampered, 'p').instruments;
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ tagName: 'XY-1', signalType: 'Unknown', confidence: 'low' });
  });
});
