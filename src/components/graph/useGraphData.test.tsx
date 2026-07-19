import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGraphData } from "./useGraphData";
import { api } from "../../lib/api";
import { __resetMockDbForTests } from "../../lib/mockBackend";
import { ENTITY_TYPE_KEYS } from "../../lib/entityTypes";
import type { EntityTypeKey } from "../../lib/entityTypes";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const ALL_TYPES = new Set<EntityTypeKey>(ENTITY_TYPE_KEYS);

describe("useGraphData (Phase 12: Universe Graph expansion)", () => {
  beforeEach(() => __resetMockDbForTests());

  it("builds a node for a character, matching Phase 1 behavior", async () => {
    await api.characters.create({ name: "Ada Voss", role: "main" });

    const { result } = renderHook(() => useGraphData(ALL_TYPES), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0]).toMatchObject({
      name: "Ada Voss",
      entityType: "character",
      subtitle: "main",
    });
  });

  // FR1.1: every one of the 10 entity types produces a node, not just
  // characters.
  it("builds a node for every one of the 10 entity types", async () => {
    await api.characters.create({ name: "Ada Voss" });
    await api.locations.create({ name: "New Geneva" });
    await api.technologies.create({ name: "Rail Rifle" });
    await api.species.create({ name: "Elari" });
    await api.military.create({ name: "3rd Battalion" });
    await api.politics.create({ name: "The Senate" });
    await api.religions.create({ name: "The Old Faith" });
    await api.organizations.create({ name: "Ashenford Guild" });
    await api.canon.create({ name: "First Contact Event" });
    await api.events.create({ name: "The Founding", start_date: "2200-01-01" });

    const { result } = renderHook(() => useGraphData(ALL_TYPES), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const typesPresent = new Set(result.current.nodes.map((n) => n.entityType));
    for (const type of ENTITY_TYPE_KEYS) {
      expect(typesPresent.has(type)).toBe(true);
    }
    expect(result.current.nodes).toHaveLength(10);
  });

  it("excludes a type's nodes when its filter is inactive (FR2.2)", async () => {
    await api.characters.create({ name: "Ada Voss" });
    await api.locations.create({ name: "New Geneva" });

    const filter = new Set<EntityTypeKey>(["character"]);
    const { result } = renderHook(() => useGraphData(filter), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].entityType).toBe("character");
  });

  it("computes degree across relationships linking two different entity types", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "New Geneva" });
    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: location.id,
      relationship_type: "located_at",
    });

    const { result } = renderHook(() => useGraphData(ALL_TYPES), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const charNode = result.current.nodes.find((n) => n.id === character.id);
    const locNode = result.current.nodes.find((n) => n.id === location.id);
    expect(charNode?.degree).toBe(1);
    expect(locNode?.degree).toBe(1);
    expect(result.current.links).toHaveLength(1);
  });

  it("excludes a link when one endpoint's type is filtered out", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "New Geneva" });
    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: location.id,
      relationship_type: "located_at",
    });

    const filter = new Set<EntityTypeKey>(["character"]);
    const { result } = renderHook(() => useGraphData(filter), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.links).toHaveLength(0);
  });
});
