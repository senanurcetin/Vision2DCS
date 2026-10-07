import { AnalysisProject } from '../types';
import { normalizeInstrument } from './normalizeInstruments';
import { isProject } from './projectStore';

const FORMAT = 'vision2dcs-project';
const VERSION = 1;

export const serializeProject = (project: AnalysisProject): string =>
  JSON.stringify({ format: FORMAT, version: VERSION, project }, null, 2);

// Only inline images may reach <img src> and the twin download <a href>;
// anything else (javascript:, remote URLs) from a shared file is dropped.
const safeImage = (value: unknown): string =>
  typeof value === 'string' && value.startsWith('data:image/') ? value : '';

/**
 * Reads a backup file. The file is untrusted: the envelope is checked, every
 * instrument is re-normalized and the project gets a fresh id.
 */
export const parseProjectBackup = (text: string, newId: string): AnalysisProject => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  const envelope = parsed as { format?: unknown; version?: unknown; project?: unknown } | null;
  if (envelope?.format !== FORMAT) throw new Error('The file is not a Vision2DCS project backup.');
  if (envelope.version !== VERSION) throw new Error(`Unsupported backup version: ${String(envelope.version)}.`);
  if (!isProject(envelope.project)) throw new Error('The backup does not contain a valid project.');

  const project = envelope.project;
  const twin = safeImage(project.digitalTwinUrl);
  return {
    id: newId,
    name: String(project.name).trim() || 'Imported project',
    date: typeof project.date === 'string' ? project.date : new Date().toLocaleString(),
    imageUrl: safeImage(project.imageUrl),
    instruments: (project.instruments as unknown[])
      .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null && !Array.isArray(i))
      .map((i, index) => normalizeInstrument(i, index, `${newId}-inst`)),
    ...(twin ? { digitalTwinUrl: twin } : {}),
  };
};
