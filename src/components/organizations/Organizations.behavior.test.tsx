import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 10 (Organizations), exercised
// through the full app tree against the mock backend -- same approach as
// every prior phase's behavior test file. Acceptance criteria references
// are to requirements-phase-10-organizations.md. AC11 (the symmetric.rs
// extraction is behavior-preserving) is proven by the pre-existing
// Politics Rust and frontend test suites passing unmodified, not by a
// new test in this file.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Organizations (Phase 10)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating an organization persists with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/organizations");

    expect(await screen.findByText(/No organizations yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    const nameInput = await screen.findByDisplayValue("New Organization");
    fireEvent.change(nameInput, { target: { value: "Ashenford Trading Guild" } });

    await waitFor(async () => {
      const orgs = await api.organizations.list();
      const found = orgs.find((o) => o.name === "Ashenford Trading Guild");
      expect(found).toBeDefined();
      expect(found?.classification).toBe("other");
    });

    // Persistence check: unmount + fresh mount simulates an app restart.
    first.unmount();
    renderApp("/organizations");
    expect(await screen.findByText("Ashenford Trading Guild")).toBeInTheDocument();
  });

  it("setting a parent organization shows up as parent on one side and subsidiary on the other (AC2)", async () => {
    const guild = await api.organizations.create({ name: "Ashenford Trading Guild" });
    const chapter = await api.organizations.create({ name: "Riverside Chapter" });

    const first = renderApp("/organizations");
    await userEvent.setup().click(await screen.findByText("Riverside Chapter"));

    const parentSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === guild.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("parent organization select not populated yet");
      return found;
    });
    fireEvent.change(parentSelect, { target: { value: guild.id } });

    await waitFor(async () => {
      const updated = await api.organizations.get(chapter.id);
      expect(updated.parent_organization_id).toBe(guild.id);
    });

    // Riverside Chapter's own detail view shows the guild as its parent.
    const parentHeading = await screen.findByText("Parent");
    await waitFor(() => {
      expect(
        within(parentHeading.closest("div") as HTMLElement).getByText("Ashenford Trading Guild"),
      ).toBeInTheDocument();
    });

    // The guild's own detail view shows Riverside Chapter as a subsidiary.
    first.unmount();
    renderApp("/organizations");
    await userEvent.setup().click(await screen.findByText("Ashenford Trading Guild"));
    const subsidiariesHeading = await screen.findByText("Subsidiaries");
    await waitFor(() => {
      expect(
        within(subsidiariesHeading.closest("div") as HTMLElement).getByText("Riverside Chapter"),
      ).toBeInTheDocument();
    });
  });

  it("setting an organization's parent to its own descendant is rejected (AC3)", async () => {
    const guild = await api.organizations.create({ name: "Ashenford Trading Guild" });
    const chapter = await api.organizations.create({
      name: "Riverside Chapter",
      parent_organization_id: guild.id,
    });

    await expect(
      api.organizations.update(guild.id, { parent_organization_id: chapter.id }),
    ).rejects.toThrow();

    const stillRoot = await api.organizations.get(guild.id);
    expect(stillRoot.parent_organization_id).toBeNull();

    await expect(
      api.organizations.update(chapter.id, { parent_organization_id: chapter.id }),
    ).rejects.toThrow();
  });

  it("deleting an organization with a subsidiary reparents the subsidiary to root, not orphaned/deleted (AC4)", async () => {
    const guild = await api.organizations.create({ name: "Ashenford Trading Guild" });
    const chapter = await api.organizations.create({
      name: "Riverside Chapter",
      parent_organization_id: guild.id,
    });

    await api.organizations.delete(guild.id);

    const survived = await api.organizations.get(chapter.id);
    expect(survived.parent_organization_id).toBeNull();

    await expect(api.organizations.get(guild.id)).rejects.toThrow();

    renderApp("/organizations");
    expect(await screen.findByText("Riverside Chapter")).toBeInTheDocument();
    expect(screen.queryByText("Ashenford Trading Guild")).not.toBeInTheDocument();
  });

  it("linking a character via affiliated_with shows up on both sides (AC5)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const org = await api.organizations.create({ name: "Ashenford Trading Guild" });

    const first = renderApp("/organizations");
    await userEvent.setup().click(await screen.findByText("Ashenford Trading Guild"));

    const memberSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("member select not populated yet");
      return found;
    });
    const memberRow = memberSelect.closest("div") as HTMLElement;
    fireEvent.change(memberSelect, { target: { value: character.id } });
    fireEvent.click(within(memberRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(org.id);
      expect(rels.some((r) => r.relationship_type === "affiliated_with")).toBe(true);
    });

    expect(await screen.findByText("Ada Voss")).toBeInTheDocument();

    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("Ashenford Trading Guild")).toBeInTheDocument();
  });

  it("linking a location via operates_at shows up on both sides (AC6)", async () => {
    const location = await api.locations.create({ name: "Ashenford Docks" });
    const org = await api.organizations.create({ name: "Ashenford Trading Guild" });

    const first = renderApp("/organizations");
    await userEvent.setup().click(await screen.findByText("Ashenford Trading Guild"));

    const locationSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === location.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("location select not populated yet");
      return found;
    });
    const locationRow = locationSelect.closest("div") as HTMLElement;
    fireEvent.change(locationSelect, { target: { value: location.id } });
    fireEvent.click(within(locationRow).getByRole("button", { name: "Link" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(org.id);
      expect(rels.some((r) => r.relationship_type === "operates_at")).toBe(true);
    });

    expect(await screen.findByText("Ashenford Docks")).toBeInTheDocument();

    first.unmount();
    renderApp("/locations");
    await userEvent.setup().click(await screen.findByText("Ashenford Docks"));
    const operatesHeading = await screen.findByText("Organizations Operating Here");
    await waitFor(() => {
      expect(
        within(operatesHeading.closest("div") as HTMLElement).getByText("Ashenford Trading Guild"),
      ).toBeInTheDocument();
    });
  });

  it("marking two organizations org_allied_with shows symmetrically on both sides regardless of initiating direction (AC7)", async () => {
    const guild = await api.organizations.create({ name: "Ashenford Trading Guild" });
    const runners = await api.organizations.create({ name: "Void Runners" });

    const first = renderApp("/organizations");
    await userEvent.setup().click(await screen.findByText("Ashenford Trading Guild"));

    // Scope to the "Alliances & Rivalries" section specifically: the
    // "Set parent organization…" picker elsewhere on this same detail
    // view also lists every other organization (including Void Runners)
    // as a candidate, so a page-wide select lookup by option value would
    // be ambiguous between the two pickers.
    const allianceHeading = await screen.findByText("Alliances & Rivalries");
    const allianceSection = allianceHeading.closest("div") as HTMLElement;
    const diplomaticSelect = await waitFor(() => {
      const selects = within(allianceSection).getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === runners.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("diplomatic relations select not populated yet");
      return found;
    });
    fireEvent.change(diplomaticSelect, { target: { value: runners.id } });
    await userEvent.setup().click(within(allianceSection).getByRole("button", { name: "Mark as Ally" }));

    await waitFor(async () => {
      const allies = await api.organizations.listAllies(guild.id);
      expect(allies.some((a) => a.id === runners.id)).toBe(true);
    });

    const alliesHeading = await screen.findByText("Allies");
    await waitFor(() => {
      expect(
        within(alliesHeading.closest("div") as HTMLElement).getByText("Void Runners"),
      ).toBeInTheDocument();
    });

    first.unmount();
    renderApp("/organizations");
    await userEvent.setup().click(await screen.findByText("Void Runners"));
    const alliesHeading2 = await screen.findByText("Allies");
    await waitFor(() => {
      expect(
        within(alliesHeading2.closest("div") as HTMLElement).getByText("Ashenford Trading Guild"),
      ).toBeInTheDocument();
    });
  });

  it("a duplicate org_allied_with, or org_rival_of when already allied (or vice versa), is rejected (AC8)", async () => {
    const guild = await api.organizations.create({ name: "Ashenford Trading Guild" });
    const runners = await api.organizations.create({ name: "Void Runners" });

    await api.organizations.createSymmetricEdge(guild.id, runners.id, "org_allied_with");

    await expect(
      api.organizations.createSymmetricEdge(runners.id, guild.id, "org_allied_with"),
    ).rejects.toThrow();
    expect(await api.organizations.listAllies(guild.id)).toHaveLength(1);

    await expect(
      api.organizations.createSymmetricEdge(runners.id, guild.id, "org_rival_of"),
    ).rejects.toThrow();
    expect(await api.organizations.listRivals(guild.id)).toHaveLength(0);

    const cartel = await api.organizations.create({ name: "Ember Cartel" });
    await api.organizations.createSymmetricEdge(guild.id, cartel.id, "org_rival_of");
    await expect(
      api.organizations.createSymmetricEdge(cartel.id, guild.id, "org_allied_with"),
    ).rejects.toThrow();
  });

  it("deleting an organization cleans up all four relationship types without touching the other side (AC9)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const location = await api.locations.create({ name: "Ashenford Docks" });
    const guild = await api.organizations.create({ name: "Ashenford Trading Guild" });
    const runners = await api.organizations.create({ name: "Void Runners" });

    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: guild.id,
      relationship_type: "affiliated_with",
    });
    await api.relationships.create({
      source_entity_id: guild.id,
      target_entity_id: location.id,
      relationship_type: "operates_at",
    });
    await api.organizations.createSymmetricEdge(guild.id, runners.id, "org_allied_with");

    await api.organizations.delete(guild.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.organizations.list()).some((o) => o.id === guild.id)).toBe(false);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);
    expect((await api.locations.list()).some((l) => l.id === location.id)).toBe(true);
    expect((await api.organizations.list()).some((o) => o.id === runners.id)).toBe(true);
  });

  it("dashboard Organizations card shows live, accurate total and classification-breakdown counts (AC10)", async () => {
    await api.organizations.create({ name: "Ashenford Trading Guild", classification: "guild" });
    await api.organizations.create({ name: "Void Runners", classification: "syndicate" });
    await api.organizations.create({ name: "Ember Cartel", classification: "criminal_enterprise" });

    renderApp("/");
    const orgsCard = await screen.findByRole("button", { name: /Organizations/ });

    // Both the total and classifications-in-use metrics are 3 here, so
    // expect two occurrences of "3" within the card rather than
    // disambiguating (same class of coincidence Phases 5-9's cards hit).
    await waitFor(() => {
      expect(within(orgsCard).getAllByText("3")).toHaveLength(2);
    });
  });

  it("navigates to Organizations via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Organizations/ }));
    expect(await screen.findByText(/No organizations yet/)).toBeInTheDocument();
  });
});
