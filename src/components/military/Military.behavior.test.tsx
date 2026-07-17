import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 7 (Military), exercised
// through the full app tree against the mock backend -- same approach as
// every prior phase's behavior test file. Acceptance criteria references
// are to requirements-phase-7-military.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Military (Phase 7)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating a military unit persists with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/military");

    expect(await screen.findByText(/No military units yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    const nameInput = await screen.findByDisplayValue("New Unit");
    fireEvent.change(nameInput, { target: { value: "1st Battalion" } });

    await waitFor(async () => {
      const units = await api.military.list();
      const found = units.find((u) => u.name === "1st Battalion");
      expect(found).toBeDefined();
      expect(found?.branch).toBe("other");
    });

    // Persistence check: unmount + fresh mount simulates an app restart.
    first.unmount();
    renderApp("/military");
    expect(await screen.findByText("1st Battalion")).toBeInTheDocument();
  });

  it("setting a parent unit shows up as parent on one side and subordinate on the other (AC2)", async () => {
    const battalion = await api.military.create({ name: "1st Battalion" });
    const company = await api.military.create({ name: "Company A" });

    const first = renderApp("/military");
    await userEvent.setup().click(await screen.findByText("Company A"));

    const parentSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === battalion.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("parent unit select not populated yet");
      return found;
    });
    fireEvent.change(parentSelect, { target: { value: battalion.id } });

    await waitFor(async () => {
      const updated = await api.military.get(company.id);
      expect(updated.parent_unit_id).toBe(battalion.id);
    });

    // Company A's own detail view shows 1st Battalion as its parent. Both
    // the "Parent Unit" <select> label and the read-only "Chain of
    // Command" section's heading share the exact text "Parent Unit", so
    // scope to the second occurrence (the read-only section, which
    // renders the resolved parent's name as plain text rather than a
    // <select>'s options).
    await waitFor(() => {
      const parentUnitHeadings = screen.getAllByText("Parent Unit");
      const chainOfCommandHeading = parentUnitHeadings[parentUnitHeadings.length - 1];
      expect(
        within(chainOfCommandHeading.closest("div") as HTMLElement).getByText("1st Battalion"),
      ).toBeInTheDocument();
    });

    // 1st Battalion's own detail view shows Company A as a subordinate unit.
    first.unmount();
    renderApp("/military");
    await userEvent.setup().click(await screen.findByText("1st Battalion"));
    const subordinatesHeading = await screen.findByText("Subordinate Units");
    await waitFor(() => {
      expect(
        within(subordinatesHeading.closest("div") as HTMLElement).getByText("Company A"),
      ).toBeInTheDocument();
    });
  });

  it("setting a unit's parent to its own descendant is rejected (AC3)", async () => {
    const battalion = await api.military.create({ name: "1st Battalion" });
    const company = await api.military.create({
      name: "Company A",
      parent_unit_id: battalion.id,
    });

    // 1st Battalion (ancestor) cannot become subordinate to Company A
    // (its own descendant).
    await expect(
      api.military.update(battalion.id, { parent_unit_id: company.id }),
    ).rejects.toThrow();

    const stillTop = await api.military.get(battalion.id);
    expect(stillTop.parent_unit_id).toBeNull();

    // A unit cannot become its own parent either.
    await expect(
      api.military.update(company.id, { parent_unit_id: company.id }),
    ).rejects.toThrow();
  });

  it("deleting a unit with a subordinate reparents the subordinate to root, not orphaned/deleted (AC4)", async () => {
    const battalion = await api.military.create({ name: "1st Battalion" });
    const company = await api.military.create({
      name: "Company A",
      parent_unit_id: battalion.id,
    });

    await api.military.delete(battalion.id);

    const survived = await api.military.get(company.id);
    expect(survived.parent_unit_id).toBeNull();

    await expect(api.military.get(battalion.id)).rejects.toThrow();

    renderApp("/military");
    expect(await screen.findByText("Company A")).toBeInTheDocument();
    expect(screen.queryByText("1st Battalion")).not.toBeInTheDocument();
  });

  it("linking a character to a unit via serves_in shows up on both sides (AC5)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const unit = await api.military.create({ name: "1st Battalion" });

    const first = renderApp("/military");
    await userEvent.setup().click(await screen.findByText("1st Battalion"));

    const personnelSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("personnel select not populated yet");
      return found;
    });
    const personnelRow = personnelSelect.closest("div") as HTMLElement;
    fireEvent.change(personnelSelect, { target: { value: character.id } });
    fireEvent.click(within(personnelRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(unit.id);
      expect(rels.some((r) => r.relationship_type === "serves_in")).toBe(true);
    });

    // The unit's own detail view shows the character.
    expect(await screen.findByText("Ada Voss")).toBeInTheDocument();

    // The character's own detail view shows the unit.
    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("1st Battalion")).toBeInTheDocument();
  });

  it("linking a unit to a location via stationed_at shows up on both sides (AC6)", async () => {
    const location = await api.locations.create({ name: "Fort Meridian" });
    const unit = await api.military.create({ name: "1st Battalion" });

    const first = renderApp("/military");
    await userEvent.setup().click(await screen.findByText("1st Battalion"));

    const stationingSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === location.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("stationing select not populated yet");
      return found;
    });
    const stationingRow = stationingSelect.closest("div") as HTMLElement;
    fireEvent.change(stationingSelect, { target: { value: location.id } });
    fireEvent.click(within(stationingRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(unit.id);
      expect(rels.some((r) => r.relationship_type === "stationed_at")).toBe(true);
    });

    // The unit's own detail view shows the location.
    expect(await screen.findByText("Fort Meridian")).toBeInTheDocument();

    // The location's own detail view shows the unit stationed there.
    first.unmount();
    renderApp("/locations");
    await userEvent.setup().click(await screen.findByText("Fort Meridian"));
    const stationedHeading = await screen.findByText("Military Units Stationed Here");
    await waitFor(() => {
      expect(
        within(stationedHeading.closest("div") as HTMLElement).getByText("1st Battalion"),
      ).toBeInTheDocument();
    });
  });

  it("linking a unit to a technology via equipped_with shows up on both sides (AC7)", async () => {
    const tech = await api.technologies.create({ name: "Rail Rifle" });
    const unit = await api.military.create({ name: "1st Battalion" });

    const first = renderApp("/military");
    await userEvent.setup().click(await screen.findByText("1st Battalion"));

    const equipmentSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === tech.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("equipment select not populated yet");
      return found;
    });
    const equipmentRow = equipmentSelect.closest("div") as HTMLElement;
    fireEvent.change(equipmentSelect, { target: { value: tech.id } });
    fireEvent.click(within(equipmentRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(unit.id);
      expect(rels.some((r) => r.relationship_type === "equipped_with")).toBe(true);
    });

    // The unit's own detail view shows the technology.
    expect(await screen.findByText("Rail Rifle")).toBeInTheDocument();

    // The technology's own detail view shows the unit equipped with it.
    first.unmount();
    renderApp("/technology");
    await userEvent.setup().click(await screen.findByText("Rail Rifle"));
    const equippedHeading = await screen.findByText("Equipped Military Units");
    await waitFor(() => {
      expect(
        within(equippedHeading.closest("div") as HTMLElement).getByText("1st Battalion"),
      ).toBeInTheDocument();
    });
  });

  it("deleting a unit cleans up serves_in/stationed_at/equipped_with relationships without touching the other side (AC8)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "Fort Meridian" });
    const tech = await api.technologies.create({ name: "Rail Rifle" });
    const unit = await api.military.create({ name: "1st Battalion" });

    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: unit.id,
      relationship_type: "serves_in",
    });
    await api.relationships.create({
      source_entity_id: unit.id,
      target_entity_id: location.id,
      relationship_type: "stationed_at",
    });
    await api.relationships.create({
      source_entity_id: unit.id,
      target_entity_id: tech.id,
      relationship_type: "equipped_with",
    });

    await api.military.delete(unit.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.military.list()).some((u) => u.id === unit.id)).toBe(false);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);
    expect((await api.locations.list()).some((l) => l.id === location.id)).toBe(true);
    expect((await api.technologies.list()).some((t) => t.id === tech.id)).toBe(true);
  });

  it("dashboard Military card shows live, accurate total and branch-breakdown counts (AC9)", async () => {
    await api.military.create({ name: "1st Battalion", branch: "army" });
    await api.military.create({ name: "3rd Fleet", branch: "navy" });
    await api.military.create({ name: "Shadow Cell", branch: "special_forces" });

    renderApp("/");
    const militaryCard = await screen.findByRole("button", { name: /Military/ });

    // Both the total and branches-in-use metrics are 3 here, so expect
    // two occurrences of "3" within the card rather than disambiguating
    // (same class of coincidence Phase 5/6's cards hit).
    await waitFor(() => {
      expect(within(militaryCard).getAllByText("3")).toHaveLength(2);
    });
  });

  it("navigates to Military via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Military/ }));
    expect(await screen.findByText(/No military units yet/)).toBeInTheDocument();
  });
});
