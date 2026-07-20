import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Project {
  id: string;
  name: string;
  /**
   * Filesystem path to the project's data folder. Populated once the
   * Tauri backend owns project storage; left undefined for
   * browser-only/dev usage.
   */
  path?: string;
  createdAt: string;
  lastOpenedAt: string;
}

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;

  createProject: (name: string, path?: string) => Project;
  openProject: (id: string) => void;
  closeProject: () => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;

  currentProject: () => Project | null;
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,

      createProject: (name, path) => {
        const now = new Date().toISOString();
        const project: Project = {
          id: makeId(),
          name: name.trim() || "Untitled Universe",
          path,
          createdAt: now,
          lastOpenedAt: now,
        };
        set((state) => ({
          projects: [...state.projects, project],
          currentProjectId: project.id,
        }));
        return project;
      },

      openProject: (id) => {
        set((state) => ({
          currentProjectId: id,
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, lastOpenedAt: new Date().toISOString() } : p,
          ),
        }));
      },

      closeProject: () => set({ currentProjectId: null }),

      renameProject: (id, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p,
          ),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
        }));
      },

      currentProject: () => {
        const { projects, currentProjectId } = get();
        return projects.find((p) => p.id === currentProjectId) ?? null;
      },
    }),
    {
      name: "loreforge-projects",
    },
  ),
);
