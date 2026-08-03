import { create } from "zustand";

export type ThemeMode = "dark" | "light";

interface UiState {
  theme: ThemeMode;
  toggleTheme: () => void;
  selectedGraphNodeId: string | null;
  setSelectedGraphNodeId: (id: string | null) => void;
}

const THEME_STORAGE_KEY = "loreforge-theme";

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: readInitialTheme(),
  toggleTheme: () => {
    const next: ThemeMode = get().theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.classList.toggle("light", next === "light");
    set({ theme: next });
  },
  selectedGraphNodeId: null,
  setSelectedGraphNodeId: (id) => set({ selectedGraphNodeId: id }),
}));
