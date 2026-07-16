import { create } from "zustand";
import type { SaveStatus } from "../lib/types";

interface SaveStatusState {
  status: SaveStatus;
  lastError: string | null;
  pendingCount: number;
  beginSave: () => void;
  resolveSave: () => void;
  failSave: (error: string) => void;
}

// Tracks the global "All Changes Saved / Saving.../ Offline" indicator.
// Multiple fields can be saving concurrently (pendingCount), so the
// indicator only returns to "saved" once every in-flight write settles.
export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  status: "saved",
  lastError: null,
  pendingCount: 0,

  beginSave: () =>
    set((state) => ({
      status: "saving",
      pendingCount: state.pendingCount + 1,
    })),

  resolveSave: () =>
    set((state) => {
      const pendingCount = Math.max(0, state.pendingCount - 1);
      return {
        pendingCount,
        status: pendingCount === 0 ? "saved" : "saving",
        lastError: pendingCount === 0 ? null : state.lastError,
      };
    }),

  failSave: (error: string) =>
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - 1),
      status: "offline",
      lastError: error,
    })),
}));
