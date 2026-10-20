import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AnalysisProject, Instrument } from '../types';
import {
  getBrowserStorage, loadProjects, restoreSelectedProjectId,
  saveProjects, saveSelectedProjectId,
} from '../services/projectStore';
import {
  type InstrumentHistory, emptyInstrumentHistory, recordInstrumentEdit,
  undoInstrumentEdit, redoInstrumentEdit,
} from '../services/instrumentHistory';

const STORAGE_MESSAGES = {
  quota: 'Browser storage is full, so recent changes are not saved. Delete older projects from History to free space.',
  unavailable: 'Browser storage is unavailable, so projects will be lost when this page is closed.',
};

export interface ProjectState {
  projects: AnalysisProject[];
  currentId: string | null;
  /** In-memory only; image/blob history is not persisted to browser storage. */
  histories: Record<string, InstrumentHistory>;
}

export type ProjectAction =
  | { type: 'add'; project: AnalysisProject }
  | { type: 'select'; id: string | null }
  | { type: 'update'; id: string; update: (project: AnalysisProject) => AnalysisProject }
  | { type: 'edit-instruments'; id: string; change: (instruments: Instrument[]) => Instrument[] }
  | { type: 'remove'; id: string }
  | { type: 'undo'; id: string }
  | { type: 'redo'; id: string };

/**
 * Reducer commits the project and its undo stack atomically, avoiding
 * a second setState inside a functional project update (unsafe in StrictMode).
 */
export const projectReducer = (state: ProjectState, action: ProjectAction): ProjectState => {
  if (action.type === 'add') {
    // Never silently replace a saved project on an ID collision.
    if (state.projects.some(project => project.id === action.project.id)) return state;
    return {
      ...state,
      projects: [action.project, ...state.projects],
      currentId: action.project.id,
    };
  }
  if (action.type === 'select') {
    if (action.id !== null && !state.projects.some(project => project.id === action.id)) return state;
    return { ...state, currentId: action.id };
  }
  if (action.type === 'remove') {
    if (!state.projects.some(project => project.id === action.id)) return state;
    const histories = { ...state.histories };
    delete histories[action.id];
    const projects = state.projects.filter(project => project.id !== action.id);
    return {
      projects,
      currentId: state.currentId === action.id ? (projects[0]?.id ?? null) : state.currentId,
      histories,
    };
  }
  const original = state.projects.find(p => p.id === action.id);
  if (!original) return state;
  if (action.type === 'update') {
    const changed = action.update(original);
    if (changed === original) return state;
    return { ...state, projects: state.projects.map(p => p.id === action.id ? changed : p) };
  }
  const history = state.histories[action.id] ?? emptyInstrumentHistory();
  if (action.type === 'edit-instruments') {
    const instruments = action.change(original.instruments);
    if (instruments === original.instruments) return state;
    return {
      ...state,
      projects: state.projects.map(p => p.id === action.id ? { ...p, instruments } : p),
      histories: { ...state.histories, [action.id]: recordInstrumentEdit(history, original.instruments) },
    };
  }

  const transition = action.type === 'undo'
    ? undoInstrumentEdit(history, original.instruments)
    : redoInstrumentEdit(history, original.instruments);
  if (!transition) return state;
  return {
    ...state,
    projects: state.projects.map(p => p.id === action.id
      ? { ...p, instruments: transition.instruments } : p),
    histories: { ...state.histories, [action.id]: transition.history },
  };
};

/**
 * Project history with selected project derived by id and a bounded per-project
 * engineering undo stack. Async callbacks cannot overwrite newer edits.
 */
export const useProjects = () => {
  const storage = useMemo(getBrowserStorage, []);
  const [state, dispatch] = useReducer(projectReducer, storage, (browserStorage): ProjectState => {
    const projects = loadProjects(browserStorage);
    return {
      projects,
      currentId: restoreSelectedProjectId(browserStorage, projects),
      histories: {},
    };
  });
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    const result = saveProjects(storage, state.projects);
    setStorageWarning('reason' in result ? STORAGE_MESSAGES[result.reason] : null);
  }, [storage, state.projects]);

  // Store only the selected local project ID, not undo stacks or AI tokens.
  useEffect(() => {
    saveSelectedProjectId(storage, state.currentId);
  }, [storage, state.currentId]);

  const addProject = useCallback((project: AnalysisProject) => dispatch({ type: 'add', project }), []);
  const updateProject = useCallback((id: string, update: (project: AnalysisProject) => AnalysisProject) =>
    dispatch({ type: 'update', id, update }), []);
  const editInstruments = useCallback((id: string, change: (instruments: Instrument[]) => Instrument[]) =>
    dispatch({ type: 'edit-instruments', id, change }), []);
  const removeProject = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const selectProject = useCallback((id: string | null) => dispatch({ type: 'select', id }), []);
  const undoInstruments = useCallback((id: string) => dispatch({ type: 'undo', id }), []);
  const redoInstruments = useCallback((id: string) => dispatch({ type: 'redo', id }), []);

  const currentProject = state.projects.find(p => p.id === state.currentId) ?? null;
  const currentHistory = state.currentId ? state.histories[state.currentId] : undefined;

  return {
    projects: state.projects,
    currentProject,
    selectProject,
    addProject,
    updateProject,
    editInstruments,
    removeProject,
    undoInstruments,
    redoInstruments,
    canUndo: (currentHistory?.past.length ?? 0) > 0,
    canRedo: (currentHistory?.future.length ?? 0) > 0,
    storageWarning,
  };
};
