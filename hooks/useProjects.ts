import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalysisProject } from '../types';
import { getBrowserStorage, loadProjects, saveProjects } from '../services/projectStore';

const STORAGE_MESSAGES = {
  quota: 'Browser storage is full, so recent changes are not saved. Delete older projects from History to free space.',
  unavailable: 'Browser storage is unavailable, so projects will be lost when this page is closed.',
};

/**
 * Project history with the selected project derived by id. Every change goes
 * through a functional update, so async callbacks never write back stale lists.
 */
export const useProjects = () => {
  const storage = useMemo(getBrowserStorage, []);
  const [projects, setProjects] = useState<AnalysisProject[]>(() => loadProjects(storage));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    const result = saveProjects(storage, projects);
    setStorageWarning('reason' in result ? STORAGE_MESSAGES[result.reason] : null);
  }, [storage, projects]);

  const addProject = useCallback((project: AnalysisProject) => {
    setProjects(prev => [project, ...prev]);
    setCurrentId(project.id);
  }, []);

  const updateProject = useCallback((id: string, update: (project: AnalysisProject) => AnalysisProject) => {
    setProjects(prev => prev.map(p => (p.id === id ? update(p) : p)));
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setCurrentId(current => (current === id ? null : current));
  }, []);

  const currentProject = projects.find(p => p.id === currentId) ?? null;

  return {
    projects,
    currentProject,
    selectProject: setCurrentId,
    addProject,
    updateProject,
    removeProject,
    storageWarning,
  };
};
