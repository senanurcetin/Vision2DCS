import { AnalysisProject } from '../types';
import { isValidCanonicalBase64 } from './base64';

export const STORAGE_KEY = 'dcs_projects';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

export const isProject = (value: unknown): value is AnalysisProject => {
  const p = value as Partial<AnalysisProject> | null;
  return typeof p === 'object' && p !== null
    && typeof p.id === 'string'
    && typeof p.name === 'string'
    && Array.isArray(p.instruments);
};

// Stored browser state is untrusted JSON. The earlier envelope-only check
// accepted null/primitive rows that could crash audit, HMI and editor views.
// Do not invent replacement instruments or silently prune individual rows.
const REQUIRED_INSTRUMENT_STRINGS = [
  'id', 'tagName', 'equipmentType', 'description', 'engineeringUnits', 'abb800xaObject',
] as const;
const OPTIONAL_INSTRUMENT_STRINGS = ['brand', 'model', 'connectedTo', 'safetyWarning'] as const;
const SIGNAL_TYPES = new Set<unknown>(['AI', 'AO', 'DI', 'DO', 'Unknown']);
const BLOCK_TYPES = new Set<unknown>(['MonAnL', 'MonDiL', 'MotL', 'VlvL', 'VlvAnL', 'PIDConL', 'Unknown']);
const CONFIDENCE = new Set<unknown>(['high', 'medium', 'low']);
const MAX_SAVED_INSTRUMENTS = 2000;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isStoredInstrument = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return REQUIRED_INSTRUMENT_STRINGS.every(k => typeof value[k] === 'string')
    && typeof value.id === 'string' && value.id.length > 0
    && SIGNAL_TYPES.has(value.signalType)
    && BLOCK_TYPES.has(value.pcs7BlockType)
    && CONFIDENCE.has(value.confidence)
    && OPTIONAL_INSTRUMENT_STRINGS.every(k => value[k] === undefined || typeof value[k] === 'string')
    && (value.reviewed === undefined || typeof value.reviewed === 'boolean')
    && (value.estimatedCost === undefined ||
        (typeof value.estimatedCost === 'number' && Number.isFinite(value.estimatedCost)));
};

const isStoredProject = (value: unknown): value is AnalysisProject => {
  if (!isProject(value) || typeof value.date !== 'string' ||
      typeof value.imageUrl !== 'string' ||
      (value.digitalTwinUrl !== undefined && typeof value.digitalTwinUrl !== 'string') ||
      value.instruments.length > MAX_SAVED_INSTRUMENTS ||
      !value.instruments.every(isStoredInstrument)) return false;
  const ids = value.instruments.map(item => item.id);
  return new Set(ids).size === ids.length;
};

// Only permit locally embedded raster images to reach image display/download.
// A corrupted localStorage entry must not inject remote or script URLs.
const SAFE_IMAGE_HEADER = /^data:image\/(?:png|jpeg|webp);base64,/;
const safeStoredImage = (value: string): string => {
  const header = SAFE_IMAGE_HEADER.exec(value);
  if (!header) return '';
  return isValidCanonicalBase64(value.slice(header[0].length)) ? value : '';
};

/** Loads saved projects, skipping invalid project records without dropping
 * individual instruments. External/SVG image URLs are stripped. Never throws.
 * Valid local review flags remain local editing state, not certified approval.
 */
export const loadProjects = (storage: KeyValueStorage | undefined): AnalysisProject[] => {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seenIds = new Set<string>();
    const projects: AnalysisProject[] = [];
    for (const entry of parsed) {
      if (!isStoredProject(entry) || !entry.id.trim() || seenIds.has(entry.id)) continue;
      seenIds.add(entry.id);
      const twin = entry.digitalTwinUrl ? safeStoredImage(entry.digitalTwinUrl) : '';
      projects.push({
        ...entry,
        imageUrl: safeStoredImage(entry.imageUrl),
        ...(twin ? { digitalTwinUrl: twin } : { digitalTwinUrl: undefined }),
      });
    }
    return projects;
  } catch {
    return [];
  }
};

const isQuotaError = (error: unknown) =>
  error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22);

/** Saves projects, reporting (not throwing) when the browser refuses. */
export const saveProjects = (storage: KeyValueStorage | undefined, projects: AnalysisProject[]): SaveResult => {
  if (!storage) return { ok: false, reason: 'unavailable' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' };
  }
};

/** localStorage can throw on access (blocked site data), so resolve it defensively. */
export const getBrowserStorage = (): KeyValueStorage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};
