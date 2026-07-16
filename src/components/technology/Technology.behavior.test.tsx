import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 5 (Technology Bible), exercised
// through the full app tree against the mock backend -- same approach as
// every prior phase's behavior test file. Acceptance criteria references
// are to requirements-phase-5-technology.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Technology Bible (Phase 5)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating a technology persists with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/technology");

    expect(await screen.findByText(/No technologies yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    const nameInput = await screen.findByDisplayValue("New Technology");
    fireEvent.change(nameInput, { target: { value: "Void Drive" } });

    await waitFor(async () => {
      const technologies = await api.technologies.list();
      const tech = technologies.find((t) => t.name === "Void Drive");
      expect(tech).toBeDefined();
      expect(tech?.category).toBe("other");
    });

    // Persistence check: unmount + fresh mount simulates an app restart.
    first.unmount();
    renderApp("/technology");
    expect(await screen.findByText("Void Drive")).toBeInTheDocument();
  });

  it("a requires edge shows the prerequisite and dependent symmetrically (AC2)", async () => {
    const voidTheory = await api.technologies.create({ name: "Void Theory" });
    const voidDrive = await api.technologies.create({ name: "Void Drive" });

    const first = renderApp("/technology");
    await userEvent.setup().click(await screen.findByText("Void Drive"));

    // The "Add a prerequisite…" select on Void Drive's detail view should
    // offer Void Theory.
    const prereqSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === voidTheory.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("prerequisite select not populated yet");
      return found;
    });
    fireEvent.change(prereqSelect, { target: { value: voidTheory.id } });
    fireEvent.click(screen.getAllByRole("button", { name: "Link" })[0]);

    await waitFor(async () => {
      const prereqs = await api.technologies.listPrerequisites(voidDrive.id);
      expect(prereqs.some((t) => t.id === voidTheory.id)).toBe(true);
    });

    // Void Drive's own detail view shows Void Theory as a prerequisite.
    // "Void Theory" also appears in the list panel on the left, so scope
    // the assertion to the "Requires (Prerequisites)" section specifically.
    const requiresHeading = await screen.findByText("Requires (Prerequisites)");
    await waitFor(() => {
      expect(
        within(requiresHeading.closest("div") as HTMLElement).getByText("Void Theory"),
      ).toBeInTheDocument();
    });

    // Void Theory's detail view shows Void Drive as a dependent.
    first.unmount();
    renderApp("/technology");
    await userEvent.setup().click(await screen.findByText("Void Theory"));
    const dependentsHeading = await screen.findByText("Required By (Dependents)");
    await waitFor(() => {
      expect(
        within(dependentsHeading.closest("div") as HTMLElement).getByText("Void Drive"),
      ).toBeInTheDocument();
    });
  });

  it("a direct cycle (Void Theory requiring Void Drive, which already requires Void Theory) is rejected (AC3)", async () => {
    const voidTheory = await api.technologies.create({ name: "Void Theory" });
    const voidDrive = await api.technologies.create({ name: "Void Drive" });
    await api.technologies.createRequiresEdge(voidDrive.id, voidTheory.id);

    await expect(api.technologies.createRequiresEdge(voidTheory.id, voidDrive.id)).rejects.toThrow();

    // The graph is unchanged: Void Theory still has no prerequisites.
    const stillEmpty = await api.technologies.listPrerequisites(voidTheory.id);
    expect(stillEmpty).toHaveLength(0);
  });

  it("an indirect/transitive cycle (A requires B, B requires C, then C requires A) is rejected (AC4)", async () => {
    const a = await api.technologies.create({ name: "Tech A" });
    const b = await api.technologies.create({ name: "Tech B" });
    const c = await api.technologies.create({ name: "Tech C" });
    await api.technologies.createRequiresEdge(a.id, b.id); // A requires B
    await api.technologies.createRequiresEdge(b.id, c.id); // B requires C

    // C requires A would close the cycle A -> B -> C -> A.
    await expect(api.technologies.createRequiresEdge(c.id, a.id)).rejects.toThrow();

    const cPrereqs = await api.technologies.listPrerequisites(c.id);
    expect(cPrereqs).toHaveLength(0);
  });

  it("linking a character to a technology via uses_technology shows on both sides (AC5)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const technology = await api.technologies.create({ name: "Void Drive" });

    const first = renderApp("/technology");
    await userEvent.setup().click(await screen.findByText("Void Drive"));

    const usageSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("usage select not populated yet");
      return found;
    });
    fireEvent.change(usageSelect, { target: { value: character.id } });
    const linkButtons = screen.getAllByRole("button", { name: "Link" });
    fireEvent.click(linkButtons[linkButtons.length - 1]);

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(technology.id);
      expect(rels.some((r) => r.relationship_type === "uses_technology")).toBe(true);
    });

    // The technology's own detail view shows the character.
    expect(await screen.findByText("Ada Voss")).toBeInTheDocument();

    // The character's detail view shows the technology.
    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("Void Drive")).toBeInTheDocument();
  });

  it("deleting a technology cascades cleanly without touching the other side of its links (AC6)", async () => {
    const voidTheory = await api.technologies.create({ name: "Void Theory" });
    const voidDrive = await api.technologies.create({ name: "Void Drive" });
    const character = await api.characters.create({ name: "Ada Voss" });
    await api.technologies.createRequiresEdge(voidDrive.id, voidTheory.id);
    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: voidDrive.id,
      relationship_type: "uses_technology",
    });

    await api.technologies.delete(voidDrive.id);

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
    expect((await api.technologies.list()).some((t) => t.id === voidTheory.id)).toBe(true);
    expect((await api.characters.list()).some((c) => c.id === character.id)).toBe(true);
    expect((await api.technologies.list()).some((t) => t.id === voidDrive.id)).toBe(false);
  });

  it("dashboard Technology card shows live, accurate total and category-breakdown counts (AC7)", async () => {
    await api.technologies.create({ name: "Void Drive", category: "ships" });
    await api.technologies.create({ name: "Ion Cannon", category: "weapons" });
    await api.technologies.create({ name: "Fusion Core", category: "power_systems" });

    renderApp("/");
    const technologyCard = await screen.findByRole("button", { name: /Technology/ });

    // Both the total and categories-in-use metrics are 3 here, so expect
    // two occurrences of "3" within the card rather than disambiguating.
    await waitFor(() => {
      expect(within(technologyCard).getAllByText("3")).toHaveLength(2);
    });
  });

  it("navigates to the Technology Bible via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Technology Bible/ }));
    expect(await screen.findByText(/No technologies yet/)).toBeInTheDocument();
  });
});
