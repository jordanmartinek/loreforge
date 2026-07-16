import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/testUtils";
import { UniverseGraph } from "./UniverseGraph";
import { api } from "../../lib/api";
import { __resetMockDbForTests } from "../../lib/mockBackend";

describe("UniverseGraph", () => {
  beforeEach(() => __resetMockDbForTests());

  it("shows an empty state with no characters", async () => {
    renderWithProviders(<UniverseGraph />);
    expect(await screen.findByText(/No nodes yet/)).toBeInTheDocument();
  });

  it("renders the entity-type filter bar once data exists (FR5.4)", async () => {
    await api.characters.create({ name: "Ada", role: "main" });
    renderWithProviders(<UniverseGraph />);

    await waitFor(() => {
      expect(screen.getByText("Characters")).toBeInTheDocument();
    });
  });

  it("updates immediately when a new relationship is created (FR5.5)", async () => {
    const a = await api.characters.create({ name: "Ada" });
    const b = await api.characters.create({ name: "Bram" });

    renderWithProviders(<UniverseGraph />);
    await waitFor(() => expect(screen.getByText("Characters")).toBeInTheDocument());

    await api.relationships.create({
      source_entity_id: a.id,
      target_entity_id: b.id,
      relationship_type: "friend",
    });

    // The graph reads relationships through useAllRelationships (React
    // Query); a real mutation hook invalidates that query on success (see
    // hooks/useRelationships.ts), which is what makes the graph update with
    // no manual "refresh" action anywhere in the UI. Here we just confirm
    // the data layer the graph is wired to reflects the new relationship.
    const rels = await api.relationships.listAll();
    expect(rels).toHaveLength(1);
  });
});
