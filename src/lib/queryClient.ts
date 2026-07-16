import { QueryClient } from "@tanstack/react-query";

// Everything is local (SQLite on disk or the in-memory mock), so there is no
// remote staleness to worry about -- mutations invalidate the exact queries
// they affect and that's sufficient for "instant, no manual refresh" reads.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  characters: {
    all: ["characters"] as const,
    list: (filter: unknown) => ["characters", "list", filter] as const,
    detail: (id: string) => ["characters", "detail", id] as const,
  },
  relationships: {
    all: ["relationships"] as const,
    forEntity: (id: string) => ["relationships", "entity", id] as const,
  },
  events: {
    all: ["events"] as const,
    list: (filter: unknown) => ["events", "list", filter] as const,
    detail: (id: string) => ["events", "detail", id] as const,
  },
  dashboard: {
    metrics: ["dashboard", "metrics"] as const,
  },
};
