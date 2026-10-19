import type { AnalysisProject, Instrument } from '../types';
import { prepareImage } from './imageUpload';

/**
 * Hand-authored annotations of the repository's synthetic P&ID sample.
 * These are neither AI predictions nor approved vendor/plant declarations.
 * No provider, third-party URL or control system is contacted.
 */
export const createSyntheticDemoInstruments = (): Instrument[] => [
  {
    id: 'demo-ft-101', tagName: 'FT-101', equipmentType: 'Flow transmitter',
    signalType: 'AI', description: 'Synthetic reactor feed flow measurement',
    engineeringUnits: 'm³/h', pcs7BlockType: 'MonAnL',
    abb800xaObject: 'AI_Object', confidence: 'low', reviewed: false,
    connectedTo: 'FIC-101',
  },
  {
    id: 'demo-fic-101', tagName: 'FIC-101', equipmentType: 'Flow controller',
    signalType: 'AO', description: 'Synthetic feed flow indicator/controller',
    engineeringUnits: '%', pcs7BlockType: 'PIDConL',
    abb800xaObject: 'PID_Object', confidence: 'low', reviewed: false,
    connectedTo: 'FCV-101',
  },
  {
    id: 'demo-fcv-101', tagName: 'FCV-101', equipmentType: 'Control valve',
    signalType: 'AO', description: 'Synthetic feed flow control valve',
    engineeringUnits: '%', pcs7BlockType: 'VlvAnL',
    abb800xaObject: 'AO_Object', confidence: 'low', reviewed: false,
  },
  {
    id: 'demo-pt-102', tagName: 'PT-102', equipmentType: 'Pressure transmitter',
    signalType: 'AI', description: 'Synthetic downstream pressure measurement',
    engineeringUnits: 'barg', pcs7BlockType: 'MonAnL',
    abb800xaObject: 'AI_Object', confidence: 'low', reviewed: false,
  },
  {
    id: 'demo-tt-103', tagName: 'TT-103', equipmentType: 'Temperature transmitter',
    signalType: 'AI', description: 'Synthetic downstream temperature measurement',
    engineeringUnits: '°C', pcs7BlockType: 'MonAnL',
    abb800xaObject: 'AI_Object', confidence: 'low', reviewed: false,
  },
];

/** Explicit opt-in: do not populate users' existing projects automatically. */
export const createSyntheticDemoProject = async (projectId: string): Promise<AnalysisProject> => {
  // Vite bundles this genuine repository PNG into a same-origin local asset.
  const drawingUrl = new URL('../samples/flow-control-loop/drawing.png', import.meta.url).href;
  const response = await fetch(drawingUrl);
  if (!response.ok) throw new Error('The bundled synthetic P&ID sample is unavailable.');
  const drawing = await response.blob();
  const file = new File([drawing], 'synthetic-flow-control.png', { type: 'image/png' });
  const prepared = await prepareImage(file); // Browser-decoded, locally embedded raster only.
  if (prepared.mimeType !== 'image/png' || !prepared.dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('The offline sample is not a valid locally embedded PNG.');
  }
  return {
    id: projectId,
    name: 'Synthetic flow-control demo',
    date: 'Synthetic offline demonstration',
    imageUrl: prepared.dataUrl,
    instruments: createSyntheticDemoInstruments(),
  };
};
