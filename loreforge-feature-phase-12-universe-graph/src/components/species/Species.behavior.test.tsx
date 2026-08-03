import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 6 (Species Codex), exercised
// through the full app tree against the mock backend -- same approach as
// every prior phase's behavior test file. Acceptance criteria references
// are to requirements-phase-6-species.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Species Codex (Phase 6)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating a species persists with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/species");

    expect(await screen.findByText(/No species yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    const nameInput = await screen.findByDisplayValue("New Species");
    fireEvent.change(nameInput, { target: { value: "Elari" } });

    await waitFor(async () => {
      const speciesList = await api.species.list();
      const found = speciesList.find((s) => s.name === "Elari");
      expect(found).toBeDefined();
      expect(found?.classification).toBe("other");
    });

    // Persistence check: unmount + fresh mount simulates an app restart.
    first.unmount();
    renderApp("/species");
    expect(await screen.findByText("Elari")).toBeInTheDocument();
  });

  it("setting a parent species shows up as parent on one side and subspecies on the other (AC2)", async () => {
    const elari = await api.species.create({ name: "Elari" });
    const subSaharan = await api.species.create({ name: "Sub-Saharan Elari" });

    const first = renderApp("/species");
    await userEvent.setup().click(await screen.findByText("Sub-Saharan Elari"));

    // The "Parent Species" select on Sub-Saharan Elari's detail view
    // should offer Elari as a candidate.
    const parentSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === elari.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("parent species select not populated yet");
      return found;
    });
    fireEvent.change(parentSelect, { target: { value: elari.id } });

    await waitFor(async () => {
      const updated = await api.species.get(subSaharan.id);
      expect(updated.parent_species_id).toBe(elari.id);
    });

    // Sub-Saharan Elari's own detail view shows Elari as its parent,
    // scoped to the "Parent" heading (Elari also appears in the list panel
    // on the left, so a bare findByText would be ambiguous).
    const parentHeading = await screen.findByText("Parent");
    await waitFor(() => {
      expect(within(parentHeading.closest("div") as HTMLElement).getByText("Elari")).toBeInTheDocument();
    });

    // Elari's own detail view shows Sub-Saharan Elari as a subspecies.
    first.unmount();
    renderApp("/species");
    await userEvent.setup().click(await screen.findByText("Elari"));
    const subspeciesHeading = await screen.findByText("Subspecies");
    await waitFor(() => {
      expect(
        within(subspeciesHeading.closest("div") as HTMLElement).getByText("Sub-Saharan Elari"),
      ).toBeInTheDocument();
    });
  });

  it("setting a species' parent to its own descendant is rejected (AC3)", async () => {
    const elari = await api.species.create({ name: "Elari" });
    const subSaharan = await api.species.create({
      name: "Sub-Saharan Elari",
      parent_species_id: elari.id,
    });

    // Elari (ancestor) cannot become a child of Sub-Saharan Elari (its own
    // descendant).
    await expect(
      api.species.update(elari.id, { parent_species_id: subSaharan.id }),
    ).rejects.toThrow();

    const stillRoot = await api.species.get(elari.id);
    expect(stillRoot.parent_species_id).toBeNull();

    // A species cannot become its own parent either.
    await expect(
      api.species.update(subSaharan.id, { parent_species_id: subSaharan.id }),
    ).rejects.toThrow();
  });

  it("deleting a species with a subspecies reparents the subspecies to root, not orphaned/deleted (AC4)", async () => {
    const elari = await api.species.create({ name: "Elari" });
    const subSaharan = await api.species.create({
      name: "Sub-Saharan Elari",
      parent_species_id: elari.id,
    });

    await api.species.delete(elari.id);

    const survived = await api.species.get(subSaharan.id);
    expect(survived.parent_species_id).toBeNull();

    await expect(api.species.get(elari.id)).rejects.toThrow();

    renderApp("/species");
    expect(await screen.findByText("Sub-Saharan Elari")).toBeInTheDocument();
    expect(screen.queryByText("Elari")).not.toBeInTheDocument();
  });

  it("linking a character to a species via member_of shows up on both sides (AC5)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const species = await api.species.create({ name: "Elari" });

    const first = renderApp("/species");
    await userEvent.setup().click(await screen.findByText("Elari"));

    const memberSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("member select not populated yet");
      return found;
    });
    fireEvent.change(memberSelect, { target: { value: character.id } });
    // The select and its "Link" button are siblings in the same row; the
    // page also has a second, unrelated "Link" button for native
    // locations, so scope the click to this select's own row rather than
    // assuming ordering.
    const memberRow = memberSelect.closest("div") as HTMLElement;
    fireEvent.click(within(memberRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(species.id);
      expect(rels.some((r) => r.relationship_type === "member_of")).toBe(true);
    });

    // The species' own detail view shows the character.
    expect(await screen.findByText("Ada Voss")).toBeInTheDocument();

    // The character's own detail view shows the species.
    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("Elari")).toBeInTheDocument();
  });

  it("linking a species to a location via native_to shows up on both sides (AC6)", async () => {
    const location = await api.locations.create({ name: "New Geneva" });
    const species = await api.species.create({ name: "Elari" });

    const first = renderApp("/species");
    await userEvent.setup().click(await screen.findByText("Elari"));

    const habitatSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === location.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("habitat select not populated yet");
      return found;
    });
    fireEvent.change(habitatSelect, { target: { value: location.id } });
    const linkButtons = screen.getAllByRole("button", { name: "Link" });
    fireEvent.click(linkButtons[linkButtons.length - 1]);

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(species.id);
      expect(rels.some((r) => r.relationship_type === "native_to")).toBe(true);
    });

    // The species' own detail view shows the location.
    expect(await screen.findByText("New Geneva")).toBeInTheDocument();

    // The location's own detail view shows the species (as a native
    // species, not a member -- opposite relationship direction, per
    // EntitySpeciesLinks' mode prop).
    first.unmount();
    renderApp("/locations");
    await userEvent.setup().click(await screen.findByText("New Geneva"));
    const nativeSpeciesHeading = await screen.findByText("Native Species");
    await waitFor(() => {
      expect(within(nativeSpeciesHeading.closest("div") as HTMLElement).getByText("Elari")).toBeInTheDocument();
    });
  });

  it("deleting a species cleans up member_of/native_to relationships without touching the other side (AC7)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "New Geneva" });
    const species = await api.species.create({ name: "Elari" });

    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: species.id,
      relationship_type: "member_of",
    });
    await api.relationships.create({
      source_entity_id: species.id,
      target_entity_id: location.id,
      relationship_type: "native_to",
    });

    await api.species.delete(species.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.species.list()).some((s) => s.id === species.id)).toBe(false);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);
    expect((await api.locations.list()).some((l) => l.id === location.id)).toBe(true);
  });

  it("dashboard Species card shows live, accurate total and classification-breakdown counts (AC8)", async () => {
    await api.species.create({ name: "Elari", classification: "sentient_humanoid" });
    await api.species.create({ name: "Void Wisp", classification: "synthetic" });
    await api.species.create({ name: "Sky Ray", classification: "non_sentient_fauna" });

    renderApp("/");
    const speciesCard = await screen.findByRole("button", { name: /Species/ });

    // Both the total and classifications-in-use metrics are 3 here, so
    // expect two occurrences of "3" within the card rather than
    // disambiguating (same class of coincidence Phase 5's Technology card
    // test hit).
    await waitFor(() => {
      expect(within(speciesCard).getAllByText("3")).toHaveLength(2);
    });
  });

  it("navigates to the Species Codex via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Species Codex/ }));
    expect(await screen.findByText(/No species yet/)).toBeInTheDocument();
  });
});
