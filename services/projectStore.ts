import { AnalysisProject } from '../types';

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

/** Loads saved projects, skipping anything malformed. Never throws. */
export const loadProjects = (storage: KeyValueStorage | undefined): AnalysisProject[] => {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProject) : [];
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
