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
  canon: {
    all: ["canon"] as const,
    list: (filter: unknown) => ["canon", "list", filter] as const,
    detail: (id: string) => ["canon", "detail", id] as const,
  },
  revisions: {
    forEntity: (id: string) => ["revisions", "entity", id] as const,
  },
  locations: {
    all: ["locations"] as const,
    list: (filter: unknown) => ["locations", "list", filter] as const,
    detail: (id: string) => ["locations", "detail", id] as const,
    children: (parentId: string | null) => ["locations", "children", parentId] as const,
    ancestry: (id: string) => ["locations", "ancestry", id] as const,
  },
  technologies: {
    all: ["technologies"] as const,
    list: (filter: unknown) => ["technologies", "list", filter] as const,
    detail: (id: string) => ["technologies", "detail", id] as const,
    prerequisites: (id: string) => ["technologies", "prerequisites", id] as const,
    dependents: (id: string) => ["technologies", "dependents", id] as const,
  },
  species: {
    all: ["species"] as const,
    list: (filter: unknown) => ["species", "list", filter] as const,
    detail: (id: string) => ["species", "detail", id] as const,
    subspecies: (parentId: string | null) => ["species", "subspecies", parentId] as const,
  },
  dashboard: {
    metrics: ["dashboard", "metrics"] as const,
  },
};
