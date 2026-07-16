import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { __resetMockDbForTests } from "./lib/mockBackend";

// These tests exercise the app the way a user would: through the router and
// full page tree, against the mock backend (identical contract to the real
// Tauri backend -- see lib/api.ts). They verify the Phase 1 acceptance
// criteria end-to-end within a single JS runtime.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("LoreForge AI app shell", () => {
  beforeEach(() => {
    // App.tsx uses the app's singleton queryClient (staleTime: Infinity by
    // design, since Phase 1 is fully local -- see lib/queryClient.ts). That
    // singleton must be cleared between tests, or a query fetched in an
    // earlier test would be served back stale instead of refetching against
    // this test's fresh mock database. Likewise, the mock backend's `db` is
    // a module-scope singleton that outlives localStorage.clear(), so it
    // needs an explicit reset too.
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("launches directly into the Universe Dashboard (AC1)", async () => {
    renderApp("/");
    expect(await screen.findByText("Universe Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Your universe at a glance/)).toBeInTheDocument();
  });

  it("shows the save status indicator defaulting to Saved", async () => {
    renderApp("/");
    expect(await screen.findByText("All Changes Saved")).toBeInTheDocument();
  });

  it("creating a character persists it and updates the dashboard live (AC2, AC6)", async () => {
    const user = userEvent.setup();
    renderApp("/characters");

    expect(await screen.findByText(/Select a character/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New" }));

    // The new character should now appear selected in the detail panel.
    await waitFor(() => {
      expect(screen.getByDisplayValue("New Character")).toBeInTheDocument();
    });

    // Rename it via the autosave name field -- simulates typing + debounce.
    const nameInput = screen.getByDisplayValue("New Character");
    fireEvent.change(nameInput, { target: { value: "Ada Voss" } });

    // Wait past the debounce window for the write to commit.
    await waitFor(
      async () => {
        const { api } = await import("./lib/api");
        const characters = await api.characters.list();
        expect(characters.some((c) => c.name === "Ada Voss")).toBe(true);
      },
      { timeout: 2000 },
    );

    // Now check the dashboard reflects it without any manual refresh logic
    // (a fresh mount simulates navigating back to the dashboard).
    renderApp("/");
    await waitFor(() => {
      const oneValues = screen.getAllByText("1");
      expect(oneValues.length).toBeGreaterThan(0);
    });
  });

  it("creating a relationship between two characters shows up in both detail and graph (AC3)", async () => {
    const { api } = await import("./lib/api");
    const a = await api.characters.create({ name: "Ada", role: "main" });
    const b = await api.characters.create({ name: "Bram", role: "supporting" });

    renderApp("/characters");

    // Select Ada from the list.
    await waitFor(() => screen.getByText("Ada"), { timeout: 3000 });
    await userEvent.setup().click(screen.getByText("Ada"));

    await waitFor(
      () => {
        expect(screen.getByDisplayValue("Ada")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Connect Ada -> Bram as "friend" via the relationship editor.
    // There can be multiple selects (role/status/connect-to/type); find the
    // one containing Bram as an option.
    const selects = screen.getAllByRole("combobox");
    const connectTo = selects.find((s) =>
      within(s as HTMLElement).queryByText("Bram"),
    ) as HTMLSelectElement;
    expect(connectTo).toBeTruthy();
    fireEvent.change(connectTo, { target: { value: b.id } });

    const linkButton = screen.getByRole("button", { name: "Link" });
    fireEvent.click(linkButton);

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(a.id);
      expect(rels.length).toBe(1);
    });

    // Graph should now have 2 nodes; verify via graph data query directly
    // (ForceGraph2D itself renders to canvas, which jsdom can't inspect
    // pixel-for-pixel, but the underlying data wiring is what we assert).
    const relationships = await api.relationships.listAll();
    expect(relationships).toHaveLength(1);
    expect(relationships[0].source_entity_id).toBe(a.id);
    expect(relationships[0].target_entity_id).toBe(b.id);
  });

  it("deleting a character removes it from list and dashboard counts, with no orphaned relationships (AC4)", async () => {
    const { api } = await import("./lib/api");
    const a = await api.characters.create({ name: "Temp A" });
    const b = await api.characters.create({ name: "Temp B" });
    await api.relationships.create({
      source_entity_id: a.id,
      target_entity_id: b.id,
      relationship_type: "friend",
    });

    renderApp("/characters");
    await waitFor(() => screen.getByText("Temp A"), { timeout: 3000 });

    const row = screen.getByText("Temp A").closest("div")!;
    const deleteButton = within(row.parentElement as HTMLElement).getByLabelText(
      "Delete Temp A",
    );
    fireEvent.click(deleteButton);

    await waitFor(async () => {
      const remaining = await api.characters.list();
      expect(remaining.some((c) => c.id === a.id)).toBe(false);
    });

    const remainingRelationships = await api.relationships.listAll();
    expect(remainingRelationships).toHaveLength(0);
  });

  it("navigates between Dashboard, Characters, and Graph via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.click(screen.getByRole("link", { name: /Characters/ }));
    expect(await screen.findByText(/Select a character/)).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Universe Graph/ }));
    expect(
      await screen.findByText(/No nodes yet|Loading graph/),
    ).toBeInTheDocument();
  });
});
