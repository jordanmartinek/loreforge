import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 9 (Religions), exercised
// through the full app tree against the mock backend -- same approach as
// every prior phase's behavior test file. Acceptance criteria references
// are to requirements-phase-9-religions.md. AC9 (the hierarchy.rs
// extraction is behavior-preserving) is proven by the pre-existing
// Locations/Species/Military Rust and frontend test suites passing
// unmodified, not by a new test in this file.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Religions (Phase 9)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating a religion persists with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/religions");

    expect(await screen.findByText(/No religions yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    const nameInput = await screen.findByDisplayValue("New Religion");
    fireEvent.change(nameInput, { target: { value: "Solari Faith" } });

    await waitFor(async () => {
      const religions = await api.religions.list();
      const found = religions.find((r) => r.name === "Solari Faith");
      expect(found).toBeDefined();
      expect(found?.classification).toBe("other");
    });

    // Persistence check: unmount + fresh mount simulates an app restart.
    first.unmount();
    renderApp("/religions");
    expect(await screen.findByText("Solari Faith")).toBeInTheDocument();
  });

  it("setting a parent religion shows up as parent on one side and schism on the other (AC2)", async () => {
    const solari = await api.religions.create({ name: "Solari Faith" });
    const reformed = await api.religions.create({ name: "Reformed Solari Rite" });

    const first = renderApp("/religions");
    await userEvent.setup().click(await screen.findByText("Reformed Solari Rite"));

    const parentSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === solari.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("parent religion select not populated yet");
      return found;
    });
    fireEvent.change(parentSelect, { target: { value: solari.id } });

    await waitFor(async () => {
      const updated = await api.religions.get(reformed.id);
      expect(updated.parent_religion_id).toBe(solari.id);
    });

    // Reformed Solari Rite's own detail view shows Solari Faith as its
    // parent, scoped to the "Parent" heading in the read-only Schisms &
    // Denominations section (Solari Faith also appears in the list panel
    // on the left, so a bare findByText would be ambiguous).
    const parentHeading = await screen.findByText("Parent");
    await waitFor(() => {
      expect(
        within(parentHeading.closest("div") as HTMLElement).getByText("Solari Faith"),
      ).toBeInTheDocument();
    });

    // Solari Faith's own detail view shows Reformed Solari Rite as a schism.
    first.unmount();
    renderApp("/religions");
    await userEvent.setup().click(await screen.findByText("Solari Faith"));
    const schismsHeading = await screen.findByText("Schisms");
    await waitFor(() => {
      expect(
        within(schismsHeading.closest("div") as HTMLElement).getByText("Reformed Solari Rite"),
      ).toBeInTheDocument();
    });
  });

  it("setting a religion's parent to its own descendant is rejected (AC3)", async () => {
    const solari = await api.religions.create({ name: "Solari Faith" });
    const reformed = await api.religions.create({
      name: "Reformed Solari Rite",
      parent_religion_id: solari.id,
    });

    // Solari Faith (ancestor) cannot become a schism of Reformed Solari
    // Rite (its own descendant).
    await expect(
      api.religions.update(solari.id, { parent_religion_id: reformed.id }),
    ).rejects.toThrow();

    const stillRoot = await api.religions.get(solari.id);
    expect(stillRoot.parent_religion_id).toBeNull();

    // A religion cannot become its own parent either.
    await expect(
      api.religions.update(reformed.id, { parent_religion_id: reformed.id }),
    ).rejects.toThrow();
  });

  it("deleting a religion with a schism reparents the schism to root, not orphaned/deleted (AC4)", async () => {
    const solari = await api.religions.create({ name: "Solari Faith" });
    const reformed = await api.religions.create({
      name: "Reformed Solari Rite",
      parent_religion_id: solari.id,
    });

    await api.religions.delete(solari.id);

    const survived = await api.religions.get(reformed.id);
    expect(survived.parent_religion_id).toBeNull();

    await expect(api.religions.get(solari.id)).rejects.toThrow();

    renderApp("/religions");
    expect(await screen.findByText("Reformed Solari Rite")).toBeInTheDocument();
    expect(screen.queryByText("Solari Faith")).not.toBeInTheDocument();
  });

  it("linking a character to a religion via follows shows up on both sides (AC5)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const religion = await api.religions.create({ name: "Solari Faith" });

    const first = renderApp("/religions");
    await userEvent.setup().click(await screen.findByText("Solari Faith"));

    const followerSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("follower select not populated yet");
      return found;
    });
    const followerRow = followerSelect.closest("div") as HTMLElement;
    fireEvent.change(followerSelect, { target: { value: character.id } });
    fireEvent.click(within(followerRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(religion.id);
      expect(rels.some((r) => r.relationship_type === "follows")).toBe(true);
    });

    // The religion's own detail view shows the follower.
    expect(await screen.findByText("Ada Voss")).toBeInTheDocument();

    // The character's own detail view shows the religion they follow.
    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("Solari Faith")).toBeInTheDocument();
  });

  it("linking a religion to a location via holy_site shows up on both sides (AC6)", async () => {
    const location = await api.locations.create({ name: "Sunspire Temple" });
    const religion = await api.religions.create({ name: "Solari Faith" });

    const first = renderApp("/religions");
    await userEvent.setup().click(await screen.findByText("Solari Faith"));

    const holySiteSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === location.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("holy site select not populated yet");
      return found;
    });
    const holySiteRow = holySiteSelect.closest("div") as HTMLElement;
    fireEvent.change(holySiteSelect, { target: { value: location.id } });
    fireEvent.click(within(holySiteRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(religion.id);
      expect(rels.some((r) => r.relationship_type === "holy_site")).toBe(true);
    });

    // The religion's own detail view shows the holy site.
    expect(await screen.findByText("Sunspire Temple")).toBeInTheDocument();

    // The location's own detail view shows the religion it's a holy
    // site for (opposite relationship direction, per EntityReligionLinks'
    // mode prop).
    first.unmount();
    renderApp("/locations");
    await userEvent.setup().click(await screen.findByText("Sunspire Temple"));
    const holySiteForHeading = await screen.findByText("Holy Site For");
    await waitFor(() => {
      expect(
        within(holySiteForHeading.closest("div") as HTMLElement).getByText("Solari Faith"),
      ).toBeInTheDocument();
    });
  });

  it("deleting a religion cleans up follows/holy_site relationships without touching the other side (AC7)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "Sunspire Temple" });
    const religion = await api.religions.create({ name: "Solari Faith" });

    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: religion.id,
      relationship_type: "follows",
    });
    await api.relationships.create({
      source_entity_id: religion.id,
      target_entity_id: location.id,
      relationship_type: "holy_site",
    });

    await api.religions.delete(religion.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.religions.list()).some((r) => r.id === religion.id)).toBe(false);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);
    expect((await api.locations.list()).some((l) => l.id === location.id)).toBe(true);
  });

  it("dashboard Religions card shows live, accurate total and classification-breakdown counts (AC8)", async () => {
    await api.religions.create({ name: "Solari Faith", classification: "organized_religion" });
    await api.religions.create({ name: "Whisper Cult", classification: "cult" });
    await api.religions.create({ name: "Void Reckoning", classification: "philosophy" });

    renderApp("/");
    const religionsCard = await screen.findByRole("button", { name: /Religions/ });

    // Both the total and classifications-in-use metrics are 3 here, so
    // expect two occurrences of "3" within the card rather than
    // disambiguating (same class of coincidence Phases 5-8's cards hit).
    await waitFor(() => {
      expect(within(religionsCard).getAllByText("3")).toHaveLength(2);
    });
  });

  it("navigates to Religions via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Religions/ }));
    expect(await screen.findByText(/No religions yet/)).toBeInTheDocument();
  });
});
