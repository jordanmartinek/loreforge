import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 4 (World Explorer / Locations),
// exercised through the full app tree against the mock backend -- same
// approach as every prior phase's behavior test file. Acceptance criteria
// references are to requirements-phase-4-locations.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("World Explorer / Locations (Phase 4)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating a 3-level hierarchy reflects all three levels in the tree with zero explicit save action (AC1)", async () => {
    const sol = await api.locations.create({ name: "Sol System" });
    const earth = await api.locations.create({ name: "Earth", parent_location_id: sol.id });
    await api.locations.create({ name: "New Geneva", parent_location_id: earth.id });

    const first = renderApp("/locations");

    // Root level shows Sol System.
    expect(await screen.findByText("Sol System")).toBeInTheDocument();

    // Expand Sol System -> Earth appears.
    await userEvent.setup().click(screen.getByRole("button", { name: "Expand Sol System" }));
    expect(await screen.findByText("Earth")).toBeInTheDocument();

    // Expand Earth -> New Geneva appears.
    await userEvent.setup().click(screen.getByRole("button", { name: "Expand Earth" }));
    expect(await screen.findByText("New Geneva")).toBeInTheDocument();

    first.unmount();
  });

  it("shows the full ancestry chain as a breadcrumb (AC2)", async () => {
    const sol = await api.locations.create({ name: "Sol System" });
    const earth = await api.locations.create({ name: "Earth", parent_location_id: sol.id });
    await api.locations.create({ name: "New Geneva", parent_location_id: earth.id });

    renderApp("/locations");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Expand Sol System" }));
    await userEvent.setup().click(await screen.findByRole("button", { name: "Expand Earth" }));
    await userEvent.setup().click(await screen.findByText("New Geneva"));

    const breadcrumb = await screen.findByRole("navigation", { name: "Location breadcrumb" });
    // The ancestry chain resolves asynchronously after the breadcrumb first
    // mounts (it starts by showing only the leaf), so wait for the full
    // chain rather than asserting immediately.
    await waitFor(() => {
      expect(within(breadcrumb).getByText("Sol System")).toBeInTheDocument();
    });
    expect(within(breadcrumb).getByText("Earth")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("New Geneva")).toBeInTheDocument();
  });

  it("deleting a middle location reparents its child up one level instead of deleting it (AC3)", async () => {
    const sol = await api.locations.create({ name: "Sol System" });
    const earth = await api.locations.create({ name: "Earth", parent_location_id: sol.id });
    const geneva = await api.locations.create({ name: "New Geneva", parent_location_id: earth.id });

    const first = renderApp("/locations");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Expand Sol System" }));
    await userEvent.setup().click(await screen.findByText("Earth"));
    await userEvent.setup().click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(async () => {
      const remaining = await api.locations.list();
      expect(remaining.some((l) => l.id === earth.id)).toBe(false);
    });

    const survivedGeneva = await api.locations.get(geneva.id);
    expect(survivedGeneva.parent_location_id).toBe(sol.id);

    first.unmount();

    // The tree should now show New Geneva directly under Sol System.
    const second = renderApp("/locations");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Expand Sol System" }));
    expect(await screen.findByText("New Geneva")).toBeInTheDocument();
    expect(screen.queryByText("Earth")).not.toBeInTheDocument();
    second.unmount();
  });

  it("moving a location to become a child of its own descendant is rejected (AC4)", async () => {
    const sol = await api.locations.create({ name: "Sol System" });
    const earth = await api.locations.create({ name: "Earth", parent_location_id: sol.id });
    const geneva = await api.locations.create({ name: "New Geneva", parent_location_id: earth.id });

    await expect(
      api.locations.update(sol.id, { parent_location_id: geneva.id }),
    ).rejects.toThrow();

    // The hierarchy is unchanged.
    const stillRoot = await api.locations.get(sol.id);
    expect(stillRoot.parent_location_id).toBeNull();
  });

  it("the client-side 'Move to' picker excludes the location's own descendants", async () => {
    const sol = await api.locations.create({ name: "Sol System" });
    const earth = await api.locations.create({ name: "Earth", parent_location_id: sol.id });
    await api.locations.create({ name: "New Geneva", parent_location_id: earth.id });
    const alphaCentauri = await api.locations.create({ name: "Alpha Centauri" });

    renderApp("/locations");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Expand Sol System" }));
    await userEvent.setup().click(await screen.findByText("Sol System"));

    // The "Move To" select for Sol System must not offer Earth or New
    // Geneva (its own descendants) as destinations, but must offer Alpha
    // Centauri (an unrelated location).
    const moveSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === "__root__"),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("move-to select not populated yet");
      return found;
    });
    const optionValues = Array.from(moveSelect.options).map((o) => o.value);
    expect(optionValues).toContain(alphaCentauri.id);
    expect(optionValues).not.toContain(earth.id);
  });

  it("linking a character to a location shows up on both sides (AC5)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "New Geneva" });

    const first = renderApp("/locations");
    await userEvent.setup().click(await screen.findByText("New Geneva"));

    const linkSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("location-relations select not populated yet");
      return found;
    });
    fireEvent.change(linkSelect, { target: { value: character.id } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(location.id);
      expect(rels.some((r) => r.relationship_type === "located_at")).toBe(true);
    });

    // The location's own detail view shows the character.
    expect(await screen.findByText("Ada Voss")).toBeInTheDocument();

    // The character's detail view shows the location.
    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("New Geneva")).toBeInTheDocument();
  });

  it("deleting a location cleans up located_at relationships without touching the linked character (AC6)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "New Geneva" });
    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: location.id,
      relationship_type: "located_at",
    });

    await api.locations.delete(location.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);
  });

  it("dashboard Locations card shows live, accurate total and type-breakdown counts (AC7)", async () => {
    await api.locations.create({ name: "Sol System", location_type: "solar_system" });
    await api.locations.create({ name: "Earth", location_type: "planet" });
    await api.locations.create({ name: "Mars", location_type: "planet" });

    renderApp("/");
    const locationsCard = await screen.findByRole("button", { name: /Locations/ });

    await waitFor(() => {
      expect(within(locationsCard).getByText("3")).toBeInTheDocument(); // total
      expect(within(locationsCard).getByText("2")).toBeInTheDocument(); // types in use
    });
  });

  it("navigates to World Explorer via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /World Explorer/ }));
    expect(await screen.findByText(/No locations yet/)).toBeInTheDocument();
  });
});
