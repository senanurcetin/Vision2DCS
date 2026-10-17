import { describe, expect, it } from 'vitest';
import type { AnalysisProject, Instrument } from '../types';
import { applyInstrumentUpdate } from './reviewState';
import { conceptExportBlockers } from './conceptExportGate';
import { buildReviewedTagMap } from './nexusTagMap';
import { parseProjectBackup, serializeProject } from './projectBackup';

const instrument: Instrument = {
  id: 'tag-1', tagName: 'PT-101', equipmentType: 'Transmitter',
  signalType: 'AI', pcs7BlockType: 'MonAnL', abb800xaObject: 'AI_Object',
  description: 'Pressure sensor', engineeringUnits: 'bar', confidence: 'high',
  reviewed: false,
};
const project: AnalysisProject = {
  id: 'proj-1', name: 'Pump room', date: '2026-10-17',
  imageUrl: 'data:image/png;base64,AQID',
  instruments: [instrument],
};
const timestamp = '2026-10-17T10:00:00.000Z';

describe('engineering review -> concept export -> backup/import acceptance', () => {
  it('blocks model output until explicit review, then re-locks after backup import', () => {
    expect(conceptExportBlockers(project.instruments).join(' ')).toMatch(/Explicit human review/);
    expect(() => buildReviewedTagMap(project, timestamp)).toThrow('review');

    const reviewed = { ...project, instruments: [applyInstrumentUpdate(instrument, { reviewed: true })] };
    const tagMap = buildReviewedTagMap(reviewed, timestamp);
    expect(tagMap.tags[0]).toMatchObject({ tag: 'PT-101', signalType: 'AI' });
    expect(JSON.stringify(tagMap)).not.toContain('imageUrl');

    const restored = parseProjectBackup(serializeProject(reviewed), 'fresh-project');
    expect(restored.imageUrl).toBe(project.imageUrl);
    expect(restored.instruments[0].reviewed).toBe(false);
    expect(() => buildReviewedTagMap(restored, timestamp)).toThrow('review');

    const reReviewed = {
      ...restored,
      instruments: [applyInstrumentUpdate(restored.instruments[0], { reviewed: true })],
    };
    expect(buildReviewedTagMap(reReviewed, timestamp).tags[0].tag).toBe('PT-101');
  });

  it('revokes user review after tag edits and rejects a duplicate before download', () => {
    const reviewed = applyInstrumentUpdate(instrument, { reviewed: true });
    const changed = applyInstrumentUpdate(reviewed, { tagName: 'PT-102' });
    expect(changed.reviewed).toBe(false);
    expect(() => buildReviewedTagMap({ ...project, instruments: [changed] }, timestamp))
      .toThrow('review');
    const duplicate = {
      ...project,
      instruments: [reviewed, { ...reviewed, id: 'tag-2', tagName: 'pt101' }],
    };
    expect(() => buildReviewedTagMap(duplicate, timestamp)).toThrow('Duplicate');
  });

  it('accepts a large valid inline backup image and rejects malformed canonical base64', () => {
    const largeImage = 'data:image/png;base64,' + 'A'.repeat(12 * 1024 * 1024);
    const restored = parseProjectBackup(
      serializeProject({ ...project, imageUrl: largeImage }),
      'large-image-import',
    );
    expect(restored.imageUrl.length).toBe(largeImage.length);
    for (const malformed of ['AAAAA', 'AA=A', 'AAA?', 'AQ===', 'AA A', 'AQ==\n']) {
      const input = serializeProject({ ...project, imageUrl: 'data:image/png;base64,' + malformed });
      expect(parseProjectBackup(input, 'bad').imageUrl).toBe('');
    }
  });

  it('does not trust remote image URLs or SVG and does not preserve a forged review approval', () => {
    const restored = parseProjectBackup(serializeProject({
      ...project,
      imageUrl: 'https://plant.example/private.jpg',
      digitalTwinUrl: 'data:image/svg+xml;base64,AAAA',
      instruments: [{ ...instrument, reviewed: true }],
    }), 'sanitized');
    expect(restored.imageUrl).toBe('');
    expect(restored).not.toHaveProperty('digitalTwinUrl');
    expect(restored.instruments[0].reviewed).toBe(false);
  });
});
