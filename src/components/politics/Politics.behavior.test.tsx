import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 8 (Politics), exercised
// through the full app tree against the mock backend -- same approach as
// every prior phase's behavior test file. Acceptance criteria references
// are to requirements-phase-8-politics.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Politics (Phase 8)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating a political entity persists with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/politics");

    expect(await screen.findByText(/No political entities yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    const nameInput = await screen.findByDisplayValue("New Political Entity");
    fireEvent.change(nameInput, { target: { value: "Meridian Concord" } });

    await waitFor(async () => {
      const entities = await api.politics.list();
      const found = entities.find((e) => e.name === "Meridian Concord");
      expect(found).toBeDefined();
      expect(found?.classification).toBe("other");
    });

    // Persistence check: unmount + fresh mount simulates an app restart.
    first.unmount();
    renderApp("/politics");
    expect(await screen.findByText("Meridian Concord")).toBeInTheDocument();
  });

  it("linking a character via leads shows up on both sides (AC2)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const entity = await api.politics.create({ name: "Meridian Concord" });

    const first = renderApp("/politics");
    await userEvent.setup().click(await screen.findByText("Meridian Concord"));

    const leaderSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("leader select not populated yet");
      return found;
    });
    const leaderRow = leaderSelect.closest("div") as HTMLElement;
    fireEvent.change(leaderSelect, { target: { value: character.id } });
    fireEvent.click(within(leaderRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(entity.id);
      expect(rels.some((r) => r.relationship_type === "leads")).toBe(true);
    });

    // The political entity's own detail view shows the leader.
    expect(await screen.findByText("Ada Voss")).toBeInTheDocument();

    // The character's own detail view shows the political entity they lead.
    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("Meridian Concord")).toBeInTheDocument();
  });

  it("linking a location via controls shows up on both sides (AC3)", async () => {
    const location = await api.locations.create({ name: "New Geneva" });
    const entity = await api.politics.create({ name: "Meridian Concord" });

    const first = renderApp("/politics");
    await userEvent.setup().click(await screen.findByText("Meridian Concord"));

    const territorySelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === location.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("territory select not populated yet");
      return found;
    });
    const territoryRow = territorySelect.closest("div") as HTMLElement;
    fireEvent.change(territorySelect, { target: { value: location.id } });
    fireEvent.click(within(territoryRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(entity.id);
      expect(rels.some((r) => r.relationship_type === "controls")).toBe(true);
    });

    // The political entity's own detail view shows the controlled territory.
    expect(await screen.findByText("New Geneva")).toBeInTheDocument();

    // The location's own detail view shows the controlling political entity.
    first.unmount();
    renderApp("/locations");
    await userEvent.setup().click(await screen.findByText("New Geneva"));
    const controlledByHeading = await screen.findByText("Controlled By");
    await waitFor(() => {
      expect(
        within(controlledByHeading.closest("div") as HTMLElement).getByText("Meridian Concord"),
      ).toBeInTheDocument();
    });
  });

  it("marking two political entities allied_with shows symmetrically on both sides regardless of initiating direction (AC4)", async () => {
    const concord = await api.politics.create({ name: "Meridian Concord" });
    const collective = await api.politics.create({ name: "Void Collective" });

    const first = renderApp("/politics");
    await userEvent.setup().click(await screen.findByText("Meridian Concord"));

    const diplomaticSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === collective.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("diplomatic relations select not populated yet");
      return found;
    });
    fireEvent.change(diplomaticSelect, { target: { value: collective.id } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Mark as Ally" }));

    await waitFor(async () => {
      const allies = await api.politics.listAllies(concord.id);
      expect(allies.some((a) => a.id === collective.id)).toBe(true);
    });

    // Meridian Concord's own detail view shows Void Collective under Allies.
    const alliesHeading = await screen.findByText("Allies");
    await waitFor(() => {
      expect(
        within(alliesHeading.closest("div") as HTMLElement).getByText("Void Collective"),
      ).toBeInTheDocument();
    });

    // Void Collective's own detail view shows Meridian Concord as an ally
    // too, even though Meridian Concord initiated the link (AC4/NFR3).
    first.unmount();
    renderApp("/politics");
    await userEvent.setup().click(await screen.findByText("Void Collective"));
    const alliesHeading2 = await screen.findByText("Allies");
    await waitFor(() => {
      expect(
        within(alliesHeading2.closest("div") as HTMLElement).getByText("Meridian Concord"),
      ).toBeInTheDocument();
    });
  });

  it("attempting to mark the same pair as allied a second time (in either direction) is rejected as a duplicate (AC5)", async () => {
    const concord = await api.politics.create({ name: "Meridian Concord" });
    const collective = await api.politics.create({ name: "Void Collective" });

    await api.politics.createSymmetricEdge(concord.id, collective.id, "allied_with");

    await expect(
      api.politics.createSymmetricEdge(collective.id, concord.id, "allied_with"),
    ).rejects.toThrow();

    const allies = await api.politics.listAllies(concord.id);
    expect(allies).toHaveLength(1);
  });

  it("attempting to mark a pair as rival_of when already allied_with (or vice versa) is rejected (AC6)", async () => {
    const concord = await api.politics.create({ name: "Meridian Concord" });
    const collective = await api.politics.create({ name: "Void Collective" });
    const ashgard = await api.politics.create({ name: "Ashgard Dominion" });

    await api.politics.createSymmetricEdge(concord.id, collective.id, "allied_with");
    await expect(
      api.politics.createSymmetricEdge(collective.id, concord.id, "rival_of"),
    ).rejects.toThrow();
    expect(await api.politics.listRivals(concord.id)).toHaveLength(0);

    await api.politics.createSymmetricEdge(concord.id, ashgard.id, "rival_of");
    await expect(
      api.politics.createSymmetricEdge(ashgard.id, concord.id, "allied_with"),
    ).rejects.toThrow();
  });

  it("removing an alliance link removes it from both entities' views (AC7)", async () => {
    const concord = await api.politics.create({ name: "Meridian Concord" });
    const collective = await api.politics.create({ name: "Void Collective" });

    const edge = await api.politics.createSymmetricEdge(concord.id, collective.id, "allied_with");
    await api.relationships.delete(edge.id);

    expect(await api.politics.listAllies(concord.id)).toHaveLength(0);
    expect(await api.politics.listAllies(collective.id)).toHaveLength(0);
  });

  it("deleting a political entity cleans up all four relationship types without touching the other side (AC8)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "New Geneva" });
    const concord = await api.politics.create({ name: "Meridian Concord" });
    const collective = await api.politics.create({ name: "Void Collective" });

    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: concord.id,
      relationship_type: "leads",
    });
    await api.relationships.create({
      source_entity_id: concord.id,
      target_entity_id: location.id,
      relationship_type: "controls",
    });
    await api.politics.createSymmetricEdge(concord.id, collective.id, "allied_with");

    await api.politics.delete(concord.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.politics.list()).some((e) => e.id === concord.id)).toBe(false);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);
    expect((await api.locations.list()).some((l) => l.id === location.id)).toBe(true);
    expect((await api.politics.list()).some((e) => e.id === collective.id)).toBe(true);
  });

  it("dashboard Politics card shows live, accurate total and classification-breakdown counts (AC9)", async () => {
    await api.politics.create({ name: "Meridian Concord", classification: "alliance" });
    await api.politics.create({ name: "Void Collective", classification: "faction" });
    await api.politics.create({ name: "Ashgard Dominion", classification: "government" });

    renderApp("/");
    const politicsCard = await screen.findByRole("button", { name: /Politics/ });

    // Both the total and classifications-in-use metrics are 3 here, so
    // expect two occurrences of "3" within the card rather than
    // disambiguating (same class of coincidence Phases 5-7's cards hit).
    await waitFor(() => {
      expect(within(politicsCard).getAllByText("3")).toHaveLength(2);
    });
  });

  it("navigates to Politics via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Politics/ }));
    expect(await screen.findByText(/No political entities yet/)).toBeInTheDocument();
  });
});
