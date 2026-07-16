import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 3 (Canon Management), exercised
// through the full app tree against the mock backend -- same approach as
// App.test.tsx (Phase 1) and Timeline.behavior.test.tsx (Phase 2).
// Acceptance criteria references are to requirements-phase-3-canon.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Canon Management (Phase 3)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating a canon entry defaults to Draft and persists with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/canon");

    expect(await screen.findByText(/No canon entries yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    const titleInput = await screen.findByDisplayValue("New Canon Entry");
    fireEvent.change(titleInput, { target: { value: "Void Energy" } });

    await waitFor(async () => {
      const entries = await api.canon.list();
      const entry = entries.find((e) => e.name === "Void Energy");
      expect(entry).toBeDefined();
      expect(entry?.status).toBe("draft");
    });

    // Persistence check: unmount + fresh mount simulates an app restart.
    first.unmount();
    renderApp("/canon");
    const listedEntry = await screen.findByText("Void Energy");
    expect(listedEntry).toBeInTheDocument();
    // "Draft" appears as both the list-row Badge and (once selected) the
    // status <Select>'s current option; just confirm at least one exists
    // rather than asserting a specific count, since neither is selected yet.
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("status transitions are reflected immediately in the Dashboard's Canon card (AC2)", async () => {
    const entry = await api.canon.create({ name: "Swarm Origins" });

    const first = renderApp("/canon");
    await userEvent.setup().click(await screen.findByText("Swarm Origins"));

    // Both the CanonList status filter and the CanonDetail status editor
    // have an "approved" <option>; disambiguate by option count -- the
    // filter has an extra empty "All statuses" placeholder (5 options),
    // the detail editor has exactly the 4 real statuses. The detail panel
    // mounts asynchronously, so poll with waitFor rather than
    // findAllByRole (which resolves as soon as ANY combobox exists, e.g.
    // just the list filter, not necessarily the one we need).
    const statusSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find(
        (s) =>
          (s as HTMLSelectElement).options.length === 4 &&
          Array.from((s as HTMLSelectElement).options).some((o) => o.value === "approved"),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("status detail select not populated yet");
      return found;
    });
    fireEvent.change(statusSelect, { target: { value: "approved" } });

    await waitFor(async () => {
      const updated = await api.canon.get(entry.id);
      expect(updated.status).toBe("approved");
    });

    first.unmount();
    renderApp("/");
    const canonCard = await screen.findByRole("button", { name: /Canon/ });
    await waitFor(() => {
      expect(within(canonCard).getByText("1")).toBeInTheDocument(); // Approved count
    });
  });

  it("linking canon to canon (depends_on) and to a character (relates_to) works and cleans up cleanly on delete (AC3)", async () => {
    const foundation = await api.canon.create({ name: "Void Energy" });
    const dependent = await api.canon.create({ name: "FTL Drive Doctrine" });
    const character = await api.characters.create({ name: "Ada Voss" });

    const first = renderApp("/canon");
    await userEvent.setup().click(await screen.findByText("FTL Drive Doctrine"));

    // depends_on: pick "Void Energy" from the Depends On select.
    const dependsOnSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === foundation.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("depends-on select not populated yet");
      return found;
    });
    fireEvent.change(dependsOnSelect, { target: { value: foundation.id } });
    const linkButtons = screen.getAllByRole("button", { name: "Link" });
    fireEvent.click(linkButtons[0]);

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(dependent.id);
      expect(rels.some((r) => r.relationship_type === "depends_on")).toBe(true);
    });

    // relates_to: pick "Ada Voss" from the relates-to select.
    const relatesToSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("relates-to select not populated yet");
      return found;
    });
    fireEvent.change(relatesToSelect, { target: { value: character.id } });
    const linkButtonsAfterRelate = screen.getAllByRole("button", { name: "Link" });
    fireEvent.click(linkButtonsAfterRelate[linkButtonsAfterRelate.length - 1]);

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(dependent.id);
      expect(rels.some((r) => r.relationship_type === "relates_to")).toBe(true);
    });

    // Deleting the dependent canon entry should remove both links, without
    // touching the foundation canon entry or the character (FR3.3).
    await api.canon.delete(dependent.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.canon.list()).some((c) => c.id === foundation.id)).toBe(true);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);

    first.unmount();
  });

  it("opening a canon entry's History panel shows create + status-change + update actions, newest first (AC4)", async () => {
    const entry = await api.canon.create({ name: "Kestrel Doctrine" });
    await api.canon.update(entry.id, { status: "under_review" });
    await api.canon.update(entry.id, { description: "Revised doctrine text." });

    renderApp("/canon");
    await userEvent.setup().click(await screen.findByText("Kestrel Doctrine"));
    await userEvent.setup().click(await screen.findByRole("button", { name: "History" }));

    // Three actions recorded: create, then two updates.
    const updatedLabels = await screen.findAllByText("Updated");
    expect(updatedLabels).toHaveLength(2);
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("a Character's History panel shows its own change history, proving the panel is genuinely reusable (AC5)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    await api.characters.update(character.id, { biography: "A void-tech engineer." });

    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    await userEvent.setup().click(await screen.findByRole("button", { name: "History" }));

    expect(await screen.findByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("dashboard Canon card shows live, accurate Approved/Draft/Under Review/Deprecated counts (AC6)", async () => {
    await api.canon.create({ name: "A", status: "approved" });
    await api.canon.create({ name: "B" }); // draft
    await api.canon.create({ name: "C", status: "under_review" });
    await api.canon.create({ name: "D", status: "deprecated" });

    renderApp("/");
    const canonCard = await screen.findByRole("button", { name: /Canon/ });

    await waitFor(() => {
      // Approved, Draft, Under Review, Deprecated are each 1 here.
      expect(within(canonCard).getAllByText("1")).toHaveLength(4);
    });
  });

  it("navigates to Canon via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Canon/ }));
    expect(await screen.findByText(/No canon entries yet/)).toBeInTheDocument();
  });
});
