// Single entry point the rest of the app imports. Selects the real Tauri IPC
// backend when running inside a native Tauri window, otherwise falls back to
// the in-memory mock backend (browser dev / preview). Everything downstream
// (hooks, components) is unaware of which one is active.

import { api as tauriApi } from "./tauri";
import { mockApi } from "./mockBackend";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const api = isTauri ? tauriApi : mockApi;
export const isRunningInTauri = isTauri;
