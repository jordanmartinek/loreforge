import { create } from "zustand";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import type { ProjectInfo } from "../lib/types";

const LAST_PROJECT_KEY = "loreforge-last-project-id";

interface ProjectState {
  projects: ProjectInfo[];
  currentProjectId: string | null;
  /** True while the initial project list / resume-last-project check is
   * still running, so App.tsx can avoid flashing the picker before we know
   * whether there's a project to resume. */
  isInitializing: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  closeProject: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  isInitializing: true,
  error: null,

  initialize: async () => {
    try {
      const projects = await api.projects.list();
      set({ projects });

      const lastId = localStorage.getItem(LAST_PROJECT_KEY);
      const lastProject = lastId && projects.find((p) => p.id === lastId);
      if (lastProject) {
        // Re-establish the backend connection for the resumed project --
        // the backend starts with a blank in-memory db every launch, it
        // has no memory of which project was open last time.
        await get().openProject(lastProject.id);
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ isInitializing: false });
    }
  },

  refreshProjects: async () => {
    const projects = await api.projects.list();
    set({ projects });
  },

  createProject: async (name) => {
    set({ error: null });
    try {
      const project = await api.projects.create(name);
      queryClient.clear();
      localStorage.setItem(LAST_PROJECT_KEY, project.id);
      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  openProject: async (id) => {
    set({ error: null });
    try {
      const project = await api.projects.open(id);
      queryClient.clear();
      localStorage.setItem(LAST_PROJECT_KEY, id);
      set((state) => ({
        currentProjectId: id,
        projects: state.projects.map((p) => (p.id === id ? project : p)),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  renameProject: async (id, name) => {
    const project = await api.projects.rename(id, name);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? project : p)),
    }));
  },

  deleteProject: async (id) => {
    await api.projects.delete(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId:
        state.currentProjectId === id ? null : state.currentProjectId,
    }));
    if (get().currentProjectId === null) {
      localStorage.removeItem(LAST_PROJECT_KEY);
      queryClient.clear();
    }
  },

  closeProject: () => {
    localStorage.removeItem(LAST_PROJECT_KEY);
    queryClient.clear();
    set({ currentProjectId: null });
  },
}));
