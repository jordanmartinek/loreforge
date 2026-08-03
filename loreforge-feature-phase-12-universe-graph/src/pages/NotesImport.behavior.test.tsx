import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import { __resetMockDbForTests } from "../lib/mockBackend";

// End-to-end behavioral coverage for Phase 11 (Notes Import), exercised
// through the full app tree against the mock backend -- same approach as
// every prior phase's behavior test file. Acceptance criteria references
// are to requirements-phase-11-notes-import.md.

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

const SAMPLE_NOTES = [
  "Character: Ada Voss",
  "Location: New Geneva",
  "The Rail Rifle is a weapon used by frontier militias.",
].join("\n");

describe("Notes Import (Phase 11)", () => {
  beforeEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });
  afterEach(() => {
    queryClient.clear();
    __resetMockDbForTests();
  });

  it("pasting text with a structured marker produces a reviewable candidate with the right type/name/confidence (AC1)", async () => {
    const user = userEvent.setup();
    renderApp("/notes-import");

    const textarea = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea, "Character: Ada Voss");
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));

    const row = (await screen.findByDisplayValue("Ada Voss")).closest("li") as HTMLElement;
    expect(within(row).getByText("Structured")).toBeInTheDocument();
    expect(within(row).getByText(/Ada Voss/)).toBeInTheDocument();

    const typeSelect = within(row).getByLabelText("Candidate entity type") as HTMLSelectElement;
    expect(typeSelect.value).toBe("character");
  });

  it("pasting text with a keyword-proximity match produces a candidate with confidence keyword and a visible snippet (AC2)", async () => {
    const user = userEvent.setup();
    renderApp("/notes-import");

    const textarea = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(
      textarea,
      "The Ashenford Trading Guild is a guild founded by river merchants.",
    );
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));

    const row = (await screen.findByDisplayValue("Ashenford Trading Guild")).closest(
      "li",
    ) as HTMLElement;
    expect(within(row).getByText("Keyword match")).toBeInTheDocument();
    expect(within(row).getByText(/Ashenford Trading Guild is a guild founded/)).toBeInTheDocument();
  });

  it("a candidate's guessed name and guessed entity type can both be edited before import (AC3)", async () => {
    const user = userEvent.setup();
    renderApp("/notes-import");

    const textarea = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea, "Character: Ada Voss");
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));

    const nameInput = await screen.findByDisplayValue("Ada Voss");
    await user.clear(nameInput);
    await user.type(nameInput, "Ada V. Voss");

    const row = nameInput.closest("li") as HTMLElement;
    const typeSelect = within(row).getByLabelText("Candidate entity type") as HTMLSelectElement;
    await user.selectOptions(typeSelect, "location");

    expect(screen.getByDisplayValue("Ada V. Voss")).toBeInTheDocument();
    expect(typeSelect.value).toBe("location");
  });

  it("flags an exact-name match against existing data as a likely duplicate, defaulting to excluded (AC4)", async () => {
    await api.characters.create({ name: "Ada Voss" });

    const user = userEvent.setup();
    renderApp("/notes-import");

    const textarea = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea, "Character: Ada Voss");
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));

    const nameInput = await screen.findByDisplayValue("Ada Voss");
    const row = nameInput.closest("li") as HTMLElement;

    // The duplicate flag depends on useExistingNamesByType()'s query
    // resolving (an async, mock-delayed fetch), which happens after the
    // candidate row itself has already rendered synchronously from the
    // parse -- so this needs a waitFor, not an immediate assertion.
    await waitFor(() => {
      expect(within(row).getByText("Possible duplicate")).toBeInTheDocument();
    });

    const checkbox = within(row).getByRole("checkbox") as HTMLInputElement;
    await waitFor(() => {
      expect(checkbox.checked).toBe(false);
    });

    // Can be included anyway (FR3.3).
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("excluding a candidate means it is not created (AC5)", async () => {
    const user = userEvent.setup();
    renderApp("/notes-import");

    const textarea = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea, "Character: Ada Voss");
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));

    const nameInput = await screen.findByDisplayValue("Ada Voss");
    const row = nameInput.closest("li") as HTMLElement;
    const checkbox = within(row).getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);

    await user.click(screen.getByRole("button", { name: /Import \d+ Selected/ }));

    await waitFor(async () => {
      const characters = await api.characters.list();
      expect(characters.some((c) => c.name === "Ada Voss")).toBe(false);
    });
  });

  it("confirming an import across multiple entity types creates exactly the right entities, and the Dashboard's counts update immediately (AC6, AC7)", async () => {
    const user = userEvent.setup();
    renderApp("/notes-import");

    const textarea = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea, SAMPLE_NOTES);
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));

    await screen.findByDisplayValue("Ada Voss");
    await screen.findByDisplayValue("New Geneva");
    await screen.findByDisplayValue("Rail Rifle");

    await user.click(screen.getByRole("button", { name: /Import \d+ Selected/ }));

    // Import summary (AC7): shows a per-type breakdown with links to the
    // created entities.
    expect(await screen.findByText(/Import complete: 3 created/)).toBeInTheDocument();
    expect(screen.getByText("Ada Voss")).toBeInTheDocument();
    expect(screen.getByText("New Geneva")).toBeInTheDocument();
    expect(screen.getByText("Rail Rifle")).toBeInTheDocument();

    const characters = await api.characters.list();
    expect(characters.some((c) => c.name === "Ada Voss")).toBe(true);
    const locations = await api.locations.list();
    expect(locations.some((l) => l.name === "New Geneva")).toBe(true);
    const technologies = await api.technologies.list();
    const rifle = technologies.find((t) => t.name === "Rail Rifle");
    expect(rifle).toBeDefined();
    expect(rifle?.category).toBe("weapons");

    // Dashboard's existing per-type counts update immediately, since
    // imports go through the exact same mutation path a manual "+ New"
    // click already uses (FR5.4) -- no Notes Import-specific dashboard
    // code is needed to satisfy this.
    renderApp("/");
    const charactersCard = await screen.findByRole("button", { name: /Characters/ });
    // The card shows Total=1 and Supporting=1 (a fresh character defaults
    // to the "supporting" role) -- both metrics coincidentally read "1",
    // so assert on the count of matches rather than a single ambiguous
    // getByText, the same class of coincidence every prior phase's
    // dashboard-card tests have hit.
    await waitFor(() => {
      expect(within(charactersCard).getAllByText("1")).toHaveLength(2);
    });
  });

  it("a single candidate's creation failure doesn't block the rest of the batch (AC8)", async () => {
    const user = userEvent.setup();
    renderApp("/notes-import");

    const textarea = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea, "Character: Ada Voss\nLocation: New Geneva");
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));

    // Blank out one candidate's name -- the mock backend rejects an empty
    // name, simulating a real creation failure for just this one
    // candidate.
    const adaInput = await screen.findByDisplayValue("Ada Voss");
    await user.clear(adaInput);

    await user.click(screen.getByRole("button", { name: /Import \d+ Selected/ }));

    expect(await screen.findByText(/Could not be created/)).toBeInTheDocument();

    // The other candidate (New Geneva) was still created despite Ada
    // Voss's failure.
    const locations = await api.locations.list();
    expect(locations.some((l) => l.name === "New Geneva")).toBe(true);
    const characters = await api.characters.list();
    expect(characters).toHaveLength(0);
  });

  it("the same pasted text produces the same candidates every time it is analyzed (AC9)", async () => {
    const user = userEvent.setup();
    const first = renderApp("/notes-import");

    const textarea1 = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea1, "Character: Ada Voss");
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));
    await screen.findByDisplayValue("Ada Voss");

    first.unmount();
    renderApp("/notes-import");

    const textarea2 = screen.getByPlaceholderText(/Paste free-form notes/);
    await user.type(textarea2, "Character: Ada Voss");
    await user.click(screen.getByRole("button", { name: "Analyze Notes" }));
    expect(await screen.findByDisplayValue("Ada Voss")).toBeInTheDocument();
  });

  it("navigates to Import Notes via the sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: /Import Notes/ }));
    expect(await screen.findByPlaceholderText(/Paste free-form notes/)).toBeInTheDocument();
  });
});
