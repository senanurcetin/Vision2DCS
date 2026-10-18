import { AnalysisProject } from '../types';
import { normalizeInstrument } from './normalizeInstruments';
import { isProject } from './projectStore';
// Pure linear base64 checker shared with the server-side image API.
import { isValidCanonicalBase64 } from './base64';

const FORMAT = 'vision2dcs-project';
const VERSION = 1;

// A 25 MiB source drawing expands to about 33.4 MiB as a base64 data URL.
// This cap covers a normal image and metadata but prevents unbounded JSON imports.
export const MAX_PROJECT_BACKUP_BYTES = 48 * 1024 * 1024;
// Keep backup import/export bounded even when an untrusted JSON file contains
// millions of tiny rows that fit below the byte limit.
export const MAX_PROJECT_BACKUP_INSTRUMENTS = 2000;
function assertBackupInstrumentCount(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > MAX_PROJECT_BACKUP_INSTRUMENTS) {
    throw new Error('Project backup exceeds the 2000 instrument limit.');
  }
};

// Missing rows in a backup cannot be reconstructed. Reject the entire file
// instead of presenting a silently incomplete instrument list.
function assertBackupInstrumentRows(value: unknown): asserts value is Record<string, unknown>[] {
  assertBackupInstrumentCount(value);
  if (value.some(item => typeof item !== 'object' || item === null || Array.isArray(item))) {
    throw new Error('Project backup contains an invalid instrument row.');
  }
};
export const assertProjectBackupBytes = (bytes: number): void => {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_PROJECT_BACKUP_BYTES) {
    throw new Error('Project backup exceeds the 48 MiB limit.');
  }
};

const checkedBackupText = (text: string): string => {
  assertProjectBackupBytes(new TextEncoder().encode(text).byteLength);
  return text;
};

export const serializeProject = (project: AnalysisProject): string => {
  assertBackupInstrumentRows(project.instruments);
  return checkedBackupText(JSON.stringify({ format: FORMAT, version: VERSION, project }, null, 2));
};

// Only inline images may reach <img src> and the twin download <a href>;
// anything else (javascript:, remote URLs) from a shared file is dropped.
const safeImage = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const header = /^data:image\/(?:png|jpeg|webp);base64,/.exec(value);
  if (!header) return '';
  // Use linear validation for permitted multi-megabyte image data rather
  // than running a variable-length regex across a potentially 48 MiB backup.
  const payload = value.slice(header[0].length);
  return isValidCanonicalBase64(payload) ? value : '';
};

/**
 * Reads a backup file. The file is untrusted: the envelope is checked, every
 * instrument is re-normalized and the project gets a fresh id.
 */
export const parseProjectBackup = (text: string, newId: string): AnalysisProject => {
  assertProjectBackupBytes(new TextEncoder().encode(text).byteLength);
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
  const instruments: unknown = project.instruments;
  assertBackupInstrumentRows(instruments);
  const twin = safeImage(project.digitalTwinUrl);
  return {
    id: newId,
    name: String(project.name).trim() || 'Imported project',
    date: typeof project.date === 'string' ? project.date : new Date().toLocaleString(),
    imageUrl: safeImage(project.imageUrl),
    instruments: instruments.map((i, index) => normalizeInstrument(i, index, `${newId}-inst`)),
    ...(twin ? { digitalTwinUrl: twin } : {}),
  };
};
