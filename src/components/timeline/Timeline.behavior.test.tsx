import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { __resetMockDbForTests } from "../../lib/mockBackend";

// End-to-end behavioral coverage for Phase 2 (Timeline System), exercised
// through the full app tree against the mock backend -- same approach as
// App.test.tsx used for Phase 1. Acceptance criteria references are to
// requirements-phase-2-timeline.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Timeline System (Phase 2)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("creating an event persists it with zero explicit save action (AC1)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/timeline");

    expect(await screen.findByText(/No events yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ New Event" }));

    const nameInput = await screen.findByPlaceholderText("The AI War Begins");
    fireEvent.change(nameInput, { target: { value: "Founding of the Colony" } });

    const dateInputs = screen.getAllByDisplayValue("");
    const startDateInput = dateInputs.find(
      (el) => (el as HTMLInputElement).type === "date",
    ) as HTMLInputElement;
    fireEvent.change(startDateInput, { target: { value: "2100-01-01" } });

    await user.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(async () => {
      const events = await api.events.list();
      expect(events.some((e) => e.name === "Founding of the Colony")).toBe(true);
    });

    // Persistence check: unmount and do a fresh mount (simulating an app
    // restart) to confirm the event is still there with zero explicit save
    // action. Unmounting first avoids stacking two live App trees (with
    // their own polling/query subscriptions) in the same document.
    first.unmount();
    renderApp("/timeline");
    expect(await screen.findByText("Founding of the Colony")).toBeInTheDocument();
  });

  it("linking an event to a character shows it in that character's Timeline section (AC2)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const event = await api.events.create({
      name: "The AI War Begins",
      start_date: "2140-01-01",
    });

    const first = renderApp("/timeline");
    await userEvent.setup().click(await screen.findByText("The AI War Begins"));

    // The modal has more than one <select> (Significance + the participant
    // picker); find the one whose <option>s include our character by name.
    // (Testing Library's getByText doesn't reliably match text inside
    // <option> elements, so check the DOM options directly instead.) The
    // participant candidate list loads asynchronously via useCharacters(),
    // so poll until it's populated rather than reading options synchronously.
    const addSelect = await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      const found = selects.find((s) =>
        Array.from((s as HTMLSelectElement).options).some((o) => o.value === character.id),
      ) as HTMLSelectElement | undefined;
      if (!found) throw new Error("participant select not populated yet");
      return found;
    });
    fireEvent.change(addSelect, { target: { value: character.id } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Add" }));

    await waitFor(async () => {
      const rels = await api.relationships.listForEntity(event.id);
      expect(rels).toHaveLength(1);
    });

    // Now check the character's detail view surfaces this event. Unmount
    // the timeline view first so we're not running two live App trees.
    first.unmount();
    renderApp("/characters");
    await userEvent.setup().click(await screen.findByText("Ada Voss"));
    expect(await screen.findByText("The AI War Begins")).toBeInTheDocument();
  });

  it("deleting an event removes it from the timeline and dashboard, and cleans up the relationship (AC3)", async () => {
    const character = await api.characters.create({ name: "Ada Voss" });
    const event = await api.events.create({
      name: "Doomed Event",
      start_date: "2140-01-01",
    });
    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: event.id,
      relationship_type: "participates_in",
    });

    renderApp("/timeline");
    await userEvent.setup().click(await screen.findByText("Doomed Event"));
    await userEvent.setup().click(await screen.findByRole("button", { name: "Delete Event" }));

    await waitFor(async () => {
      const events = await api.events.list();
      expect(events.some((e) => e.id === event.id)).toBe(false);
    });

    const remainingRelationships = await api.relationships.listForEntity(character.id);
    expect(remainingRelationships).toHaveLength(0);
  });

  it("deleting a character does NOT delete the event, only the participation link (AC4)", async () => {
    const character = await api.characters.create({ name: "Temp Character" });
    const event = await api.events.create({
      name: "Survives Character Deletion",
      start_date: "2140-01-01",
    });
    await api.relationships.create({
      source_entity_id: character.id,
      target_entity_id: event.id,
      relationship_type: "participates_in",
    });

    await api.characters.delete(character.id);

    const events = await api.events.list();
    expect(events.some((e) => e.id === event.id)).toBe(true);
    const relationships = await api.relationships.listAll();
    expect(relationships).toHaveLength(0);
  });

  it("filtering by layer shows only events tagged with an active layer (AC5)", async () => {
    await api.events.create({
      name: "War Event",
      start_date: "2140-01-01",
      layers: ["wars"],
    });
    await api.events.create({
      name: "Political Event",
      start_date: "2141-01-01",
      layers: ["political"],
    });

    renderApp("/timeline");
    await screen.findByText("War Event");
    expect(screen.getByText("Political Event")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Wars" }));

    await waitFor(() => {
      expect(screen.getByText("War Event")).toBeInTheDocument();
      expect(screen.queryByText("Political Event")).not.toBeInTheDocument();
    });
  });

  it("zooming rescales the layout without triggering a new data fetch (AC6)", async () => {
    await api.events.create({ name: "Some Event", start_date: "2140-01-01" });

    const listSpy = vi.spyOn(api.events, "list");
    renderApp("/timeline");
    await screen.findByText("Some Event");

    const callCountBeforeZoom = listSpy.mock.calls.length;
    await userEvent.setup().click(screen.getByRole("button", { name: "Month" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Decade" }));

    // Give React a tick to settle any effects triggered by the zoom change.
    await waitFor(() => {
      expect(screen.getByText("Some Event")).toBeInTheDocument();
    });

    expect(listSpy.mock.calls.length).toBe(callCountBeforeZoom);
    listSpy.mockRestore();
  });

  it("dashboard Timeline card shows live, accurate metrics (AC8)", async () => {
    await api.events.create({
      name: "Earliest",
      start_date: "2100-01-01",
      layers: ["historical"],
    });
    await api.events.create({
      name: "Latest",
      start_date: "2150-01-01",
      layers: ["wars"],
    });

    renderApp("/");

    const timelineCard = await screen.findByRole("button", { name: /Timeline/ });
    // Metrics load asynchronously; the card renders a "not available"
    // fallback until they resolve (see MetricCard.tsx), so wait for the
    // real numbers rather than asserting immediately after the card exists.
    // Both "Events" and "Layers" happen to be 2 here, so match on both
    // metric labels together rather than a bare "2" (which is ambiguous).
    await waitFor(() => {
      expect(within(timelineCard).getAllByText("2")).toHaveLength(2); // events_total, layers_in_use
    });
    expect(within(timelineCard).getByText("2100–2150")).toBeInTheDocument(); // date span
  });

  it("navigates to Timeline via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Timeline/ }));
    expect(await screen.findByText(/No events yet/)).toBeInTheDocument();
  });
});
