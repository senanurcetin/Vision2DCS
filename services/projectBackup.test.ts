import { describe, expect, it } from 'vitest';
import { AnalysisProject, Instrument } from '../types';
import { MAX_PROJECT_BACKUP_BYTES, assertProjectBackupBytes, parseProjectBackup, serializeProject } from './projectBackup';

const instrument: Instrument = {
  id: 'i1', tagName: 'PT-101', equipmentType: 'Transmitter', signalType: 'AI', description: 'Pressure',
  engineeringUnits: 'barg', pcs7BlockType: 'MonAnL', abb800xaObject: 'AI', confidence: 'high', estimatedCost: 900,
};

const project: AnalysisProject = {
  id: 'proj-1', name: 'Feed line', date: '2026-10-07', imageUrl: 'data:image/png;base64,AAAA',
  instruments: [instrument], digitalTwinUrl: 'data:image/png;base64,BBBB',
};

describe('project backup', () => {
  it('uses one byte limit for import and export, including UTF-8 overhead', () => {
    expect(() => assertProjectBackupBytes(MAX_PROJECT_BACKUP_BYTES)).not.toThrow();
    expect(() => assertProjectBackupBytes(MAX_PROJECT_BACKUP_BYTES + 1)).toThrow('48 MiB');
    expect(() => assertProjectBackupBytes(-1)).toThrow('48 MiB');
    expect(() => assertProjectBackupBytes(Number.NaN)).toThrow('48 MiB');
    const unicode = { ...project, name: 'Buhar ölçümü – basınç' };
    expect(parseProjectBackup(serializeProject(unicode), 'p').name).toBe(unicode.name);
  });

  it('does not generate an export that the imported-size contract rejects', () => {
    const exported = serializeProject(project);
    expect(() => assertProjectBackupBytes(new TextEncoder().encode(exported).byteLength)).not.toThrow();
    expect(parseProjectBackup(exported, 'reimport').instruments).toHaveLength(1);
  });

  it('round-trips a project under a new id', () => {
    const restored = parseProjectBackup(serializeProject(project), 'proj-2');
    expect(restored).toMatchObject({ ...project, id: 'proj-2', instruments: [{ ...instrument, id: 'proj-2-inst-0' }] });
  });

  it('preserves empty human-authored engineering fields instead of inventing defaults', () => {
    const intentionallyBlank: Instrument = {
      ...instrument,
      tagName: '  pt-101 ',
      equipmentType: '',
      description: '',
      engineeringUnits: '',
      abb800xaObject: '',
      brand: '',
      model: '',
      connectedTo: '',
      safetyWarning: '',
      estimatedCost: 0,
    };
    const imported = parseProjectBackup(
      serializeProject({ ...project, instruments: [intentionallyBlank] }),
      'reimport',
    );
    expect(imported.instruments[0]).toMatchObject({
      id: 'reimport-inst-0',
      tagName: 'PT-101',
      equipmentType: '',
      description: '',
      engineeringUnits: '',
      abb800xaObject: '',
      brand: '',
      model: '',
      connectedTo: '',
      safetyWarning: '',
      estimatedCost: 0,
      reviewed: false,
    });
  });

  it('does not carry attacker-supplied extra JSON fields into editor history', () => {
    const raw = JSON.stringify({
      format: 'vision2dcs-project',
      version: 1,
      project: { ...project, instruments: [{ ...instrument, privateNetworkEndpoint: 'plc://secret' }] },
    });
    const row = parseProjectBackup(raw, 'clean').instruments[0];
    expect(row).not.toHaveProperty('privateNetworkEndpoint');
    expect(row.tagName).toBe('PT-101');
  });

  it('discards an imported project claiming its instruments were already reviewed', () => {
    const tampered = { ...project, instruments: [{ ...instrument, reviewed: true }] };
    const imported = parseProjectBackup(serializeProject(tampered), 'reimport');
    expect(imported.instruments[0].reviewed).toBe(false);
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

  it('rejects inline SVG and HTML image payloads in untrusted backups', () => {
    const hostile = { ...project, imageUrl: 'data:image/svg+xml;base64,AAAA', digitalTwinUrl: 'data:text/html;base64,AAAA' };
    const imported = parseProjectBackup(serializeProject(hostile), 'p');
    expect(imported.imageUrl).toBe('');
    expect(imported).not.toHaveProperty('digitalTwinUrl');
  });

  it.each(['junk', null, 42, []])(
    'rejects a malformed backup row rather than silently dropping %j',
    (invalidRow) => {
      const tampered = JSON.stringify({
        format: 'vision2dcs-project', version: 1,
        project: { ...project, instruments: [instrument, invalidRow] },
      });
      expect(() => parseProjectBackup(tampered, 'p')).toThrow('invalid instrument row');
    },
  );

  it('refuses to serialize an unrestorable backup containing invalid instrument rows', () => {
    const invalid = { ...project, instruments: [instrument, null] as unknown as Instrument[] };
    expect(() => serializeProject(invalid)).toThrow('invalid instrument row');
  });

  it('rejects missing and corrupted engineering fields instead of normalizing them silently', () => {
    for (const invalid of [
      { tagName: 'XY-1', signalType: 'HART', confidence: 'high' },
      { ...instrument, signalType: 'HART' },
      { ...instrument, pcs7BlockType: 42 },
      { ...instrument, equipmentType: null },
      { ...instrument, confidence: 'perfect' },
      { ...instrument, id: '' },
      { ...instrument, tagName: ' ' },
      { ...instrument, connectedTo: ['PT-102'] },
    ]) {
      const raw = JSON.stringify({
        format: 'vision2dcs-project', version: 1,
        project: { ...project, instruments: [instrument, invalid] },
      });
      expect(() => parseProjectBackup(raw, 'p')).toThrow('invalid instrument row');
    }
  });

  it('rejects duplicate row IDs before attempting to restore an engineering history', () => {
    const duplicate = { ...instrument, tagName: 'TT-102' };
    const raw = JSON.stringify({
      format: 'vision2dcs-project', version: 1,
      project: { ...project, instruments: [instrument, duplicate] },
    });
    expect(() => parseProjectBackup(raw, 'p')).toThrow('duplicate instrument IDs');
    expect(() => serializeProject({ ...project, instruments: [instrument, duplicate] }))
      .toThrow('duplicate instrument IDs');
  });

  it('rejects malformed project metadata when creating and restoring backups', () => {
    for (const invalid of [
      { ...project, date: null },
      { ...project, imageUrl: 123 },
      { ...project, digitalTwinUrl: [] },
    ]) {
      expect(() => serializeProject(invalid as unknown as AnalysisProject)).toThrow('invalid project metadata');
      const raw = JSON.stringify({ format: 'vision2dcs-project', version: 1, project: invalid });
      expect(() => parseProjectBackup(raw, 'p')).toThrow('valid project');
    }
  });
  it('rejects more than 2000 imported or exported instruments before normalization', () => {
    const many = Array.from({ length: 2001 }, () => ({ tagName: 'PT-101' })) as Instrument[];
    expect(() => serializeProject({ ...project, instruments: many })).toThrow('2000 instrument limit');
    const text = JSON.stringify({
      format: 'vision2dcs-project', version: 1,
      project: { ...project, instruments: many },
    });
    expect(() => parseProjectBackup(text, 'new')).toThrow('2000 instrument limit');
  });

});
