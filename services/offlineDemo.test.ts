import { describe, expect, it } from 'vitest';
import { createSyntheticDemoInstruments } from './offlineDemo';
import { conceptExportBlockers } from './conceptExportGate';
import { isStoredInstrument } from './projectStore';
import { runSentinelAudit } from './otSentinelService';

describe('unprivileged offline NEXUS demonstration', () => {
  it('supplies five valid distinct synthetic instrumentation drafts with no review claims', () => {
    const rows = createSyntheticDemoInstruments();
    expect(rows.map(row => row.tagName)).toEqual([
      'FT-101', 'FIC-101', 'FCV-101', 'PT-102', 'TT-103',
    ]);
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.every(row => isStoredInstrument(row) && row.reviewed === false)).toBe(true);
    expect(conceptExportBlockers(rows).length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toMatch(/api.key|secret|gemini/i);
  });

  it('offers a tank-level exercise with exact annotated signal directions', () => {
    const rows = createSyntheticDemoInstruments('tank-level');
    expect(rows.map(row => row.tagName))
      .toEqual(['LT-201', 'LIC-201', 'LV-201', 'LSH-202', 'XV-203', 'P-204']);
    expect(rows.filter(row => row.connectedTo).map(row => row.tagName + '>' + row.connectedTo))
      .toEqual(['LT-201>LIC-201', 'LIC-201>LV-201']);
    expect(rows.every(row => isStoredInstrument(row) && row.reviewed === false)).toBe(true);
    expect(conceptExportBlockers(rows).length).toBeGreaterThan(0);
    expect(runSentinelAudit(rows).filter(alert => alert.severity === 'error')).toEqual([]);
  });

  it('never reports a human review or reuses mutated source row objects', () => {
    const draft = createSyntheticDemoInstruments();
    draft[0].tagName = 'MUTATED';
    draft[0].reviewed = true;
    const again = createSyntheticDemoInstruments();
    expect(again[0].tagName).toBe('FT-101');
    expect(again[0].reviewed).toBe(false);
    expect(runSentinelAudit(again).some(a => a.severity === 'error')).toBe(false);
  });
});
