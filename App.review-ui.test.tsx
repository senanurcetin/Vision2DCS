// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisProject, Instrument } from './types';

const harness = vi.hoisted(() => ({
  project: null as AnalysisProject | null,
  downloadText: vi.fn(),
  csv: vi.fn(),
  abb: vi.fn(),
  bom: vi.fn(),
}));

vi.mock('./hooks/useProjects', () => ({
  useProjects: () => {
    const [currentProject, setProject] = React.useState<AnalysisProject | null>(harness.project);
    return {
      projects: currentProject ? [currentProject] : [],
      currentProject,
      selectProject: vi.fn(),
      addProject: vi.fn(),
      updateProject: (id: string, update: (p: AnalysisProject) => AnalysisProject) =>
        setProject(p => p?.id === id ? update(p) : p),
      removeProject: vi.fn(),
      storageWarning: null,
    };
  },
}));

vi.mock('./services/geminiService', () => ({
  analyzePIDImage: vi.fn(),
  generateDigitalTwin: vi.fn(),
}));
vi.mock('./services/exportService', () => ({
  downloadText: harness.downloadText,
  downloadSiemensCSV: harness.csv,
  downloadABBXML: harness.abb,
  downloadBomCSV: harness.bom,
}));
vi.mock('./components/HmiReactFlowView', () => ({ default: () => null }));
vi.mock('./components/AuditBOM', () => ({ default: () => null }));

import App from './App';

const instrument: Instrument = {
  id: 'instrument-1', tagName: 'PT-101', equipmentType: 'Transmitter',
  signalType: 'AI', pcs7BlockType: 'MonAnL', abb800xaObject: 'AI',
  description: 'Pressure transmitter', engineeringUnits: 'bar',
  confidence: 'high', reviewed: false,
};
const fixture = (instruments: Instrument[]): AnalysisProject => ({
  id: 'proj-1', name: 'Pump room', date: '2026-10-17',
  imageUrl: 'data:image/png;base64,AQID', instruments,
});

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  harness.downloadText.mockReset();
  harness.csv.mockReset();
  harness.abb.mockReset();
  harness.bom.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function button(label: string): HTMLButtonElement {
  const match = [...host.querySelectorAll('button')].find(
    el => el.textContent?.trim() === label,
  );
  if (!match) throw new Error('Missing action button ' + label);
  return match;
}
function review(label: string): HTMLButtonElement {
  const match = host.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]');
  if (!match) throw new Error('Missing accessible review action ' + label);
  return match;
}

describe('instrument review/export DOM acceptance', () => {
  it('keeps all concept export buttons disabled until explicit user review', async () => {
    harness.project = fixture([instrument]);
    await act(async () => root.render(<App />));
    for (const label of ['SIEMENS PCS7', 'ABB 800xA', 'NEXUS TAG MAP']) {
      expect(button(label).disabled, label).toBe(true);
    }
    expect(host.textContent).toContain('Explicit human review');

    await act(async () => review('Mark PT-101 reviewed').click());
    for (const label of ['SIEMENS PCS7', 'ABB 800xA', 'NEXUS TAG MAP']) {
      expect(button(label).disabled, label).toBe(false);
    }
    await act(async () => button('NEXUS TAG MAP').click());
    expect(harness.downloadText).toHaveBeenCalledTimes(1);
    const [body, filename, mime] = harness.downloadText.mock.calls[0];
    expect(filename).toBe('nexus-tag-map-v1.json');
    expect(mime).toBe('application/json');
    expect(JSON.parse(body)).toMatchObject({
      mode: 'read-only',
      tags: [{ tag: 'PT-101', signalType: 'AI' }],
    });

    await act(async () => review('Revoke review of PT-101').click());
    expect(button('NEXUS TAG MAP').disabled).toBe(true);
    expect(harness.downloadText).toHaveBeenCalledTimes(1);
  });

  it('cannot export duplicate identities even when both were individually marked reviewed', async () => {
    harness.project = fixture([
      { ...instrument, reviewed: true },
      { ...instrument, id: 'instrument-2', tagName: 'pt101', reviewed: true },
    ]);
    await act(async () => root.render(<App />));
    expect(button('SIEMENS PCS7').disabled).toBe(true);
    expect(button('ABB 800xA').disabled).toBe(true);
    expect(button('NEXUS TAG MAP').disabled).toBe(true);
    expect(host.textContent).toContain('Duplicate instrument tag');
    expect(harness.downloadText).not.toHaveBeenCalled();
    expect(harness.csv).not.toHaveBeenCalled();
    expect(harness.abb).not.toHaveBeenCalled();
  });
  it('excludes collapsed history controls from focus and exposes an accessible toggle', async () => {
    harness.project = fixture([instrument]);
    await act(async () => root.render(<App />));
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-label="Toggle project history"]');
    const sidebar = host.querySelector<HTMLElement>('#project-history-sidebar');
    expect(toggle).not.toBeNull();
    expect(sidebar?.getAttribute('aria-label')).toBe('Project history');
    expect(toggle?.getAttribute('aria-controls')).toBe('project-history-sidebar');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar?.getAttribute('aria-hidden')).toBe('true');
    expect(sidebar?.hasAttribute('inert')).toBe(true);

    await act(async () => toggle!.click());
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar?.getAttribute('aria-hidden')).toBe('false');
    expect(sidebar?.hasAttribute('inert')).toBe(false);

    await act(async () => toggle!.click());
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar?.hasAttribute('inert')).toBe(true);
  });

  it('shows NEXUS branding and responsive engineering panels', async () => {
    harness.project = fixture([instrument]);
    await act(async () => root.render(<App />));
    expect(host.querySelector<HTMLImageElement>('img[alt="NEXUS"]')?.getAttribute('src')).toBe('/nexus-wordmark.svg');
    expect(host.querySelector<HTMLImageElement>('img[aria-hidden="true"]')?.getAttribute('src')).toBe('/nexus-x.svg');
    expect(host.querySelector('header')?.className).toContain('nexus-app-header');
    expect(host.querySelector('.nexus-engineering-panel')?.className).toContain('lg:w-1/2');
  });

});
