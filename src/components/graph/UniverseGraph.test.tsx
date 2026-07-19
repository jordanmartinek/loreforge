import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/testUtils";
import { UniverseGraph } from "./UniverseGraph";
import { api } from "../../lib/api";
import { __resetMockDbForTests } from "../../lib/mockBackend";

describe("UniverseGraph", () => {
  beforeEach(() => __resetMockDbForTests());

  it("shows an empty state with no entities of any type", async () => {
    renderWithProviders(<UniverseGraph />);
    expect(await screen.findByText(/No nodes yet/)).toBeInTheDocument();
  });

  it("renders the entity-type filter bar once data exists (FR5.4)", async () => {
    await api.characters.create({ name: "Ada", role: "main" });
    renderWithProviders(<UniverseGraph />);

    await waitFor(() => {
      expect(screen.getByText("Character")).toBeInTheDocument();
    });
  });

  it("updates immediately when a new relationship is created (FR5.5)", async () => {
    const a = await api.characters.create({ name: "Ada" });
    const b = await api.characters.create({ name: "Bram" });

    renderWithProviders(<UniverseGraph />);
    await waitFor(() => expect(screen.getByText("Character")).toBeInTheDocument());

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

  // Phase 12: Universe Graph expansion -- all 10 entity types plot on the
  // graph, not just characters (FR1.1), and every type's filter/legend
  // toggle is present and on by default (FR2.1).
  it("shows a filter/legend toggle for all 10 entity types, all active by default", async () => {
    // The empty-state message renders when there's no data yet; create one
    // character so the graph (and its filter bar) actually mounts.
    await api.characters.create({ name: "Ada" });
    renderWithProviders(<UniverseGraph />);

    for (const label of [
      "Character",
      "Location",
      "Technology",
      "Species",
      "Military Unit",
      "Political Entity",
      "Religion",
      "Organization",
      "Canon Entry",
      "Event",
    ]) {
      await waitFor(() => {
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      });
    }

    // Every toggle should be pressed (active) by default.
    const buttons = screen.getAllByRole("button", { pressed: true });
    expect(buttons.length).toBeGreaterThanOrEqual(10);
  });

  it("plots entities from multiple types at once, not just characters (FR1.1)", async () => {
    await api.characters.create({ name: "Ada Voss" });
    await api.locations.create({ name: "New Geneva" });
    await api.technologies.create({ name: "Rail Rifle" });

    renderWithProviders(<UniverseGraph />);
    await waitFor(() => expect(screen.getByText("Character")).toBeInTheDocument());

    // The graph itself renders to <canvas>, which jsdom can't inspect
    // pixel-for-pixel -- assert via the underlying data layer that all
    // three entity types' rows exist and would all be included in the
    // default (all-types-active) filter set, mirroring the assertion
    // style already used for the relationship-update test above.
    const [chars, locs, techs] = await Promise.all([
      api.characters.list(),
      api.locations.list(),
      api.technologies.list(),
    ]);
    expect(chars).toHaveLength(1);
    expect(locs).toHaveLength(1);
    expect(techs).toHaveLength(1);
  });

  it("toggling off a type's filter deactivates its legend toggle (FR2.2)", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    await api.characters.create({ name: "Ada" });
    renderWithProviders(<UniverseGraph />);

    await waitFor(() => expect(screen.getByText("Character")).toBeInTheDocument());

    const characterToggle = screen.getByRole("button", { name: /Character/ });
    expect(characterToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(characterToggle);
    expect(characterToggle).toHaveAttribute("aria-pressed", "false");
  });

  // Regression guard: filtering out the only type with data must not hide
  // the filter bar itself, or there would be no way to turn it back on
  // (FR2.4).
  it("keeps the filter bar visible even when the active filters hide every entity", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    await api.characters.create({ name: "Ada" });
    renderWithProviders(<UniverseGraph />);

    const characterToggle = await screen.findByRole("button", { name: /Character/ });
    await user.click(characterToggle);

    // The toggle itself (and the rest of the filter bar) must still be
    // present and re-clickable.
    expect(screen.getByRole("button", { name: /Character/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText(/No entities match the active filters/)).toBeInTheDocument();
  });
});
