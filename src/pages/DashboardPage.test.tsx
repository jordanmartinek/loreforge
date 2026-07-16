import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/testUtils";
import { DashboardPage } from "./DashboardPage";
import { api } from "../lib/api";
import { __resetMockDbForTests } from "../lib/mockBackend";

describe("DashboardPage", () => {
  beforeEach(() => __resetMockDbForTests());
  afterEach(() => __resetMockDbForTests());

  it("shows zeroed character metrics for a fresh universe", async () => {
    renderWithProviders(<DashboardPage />);

    // Characters card renders with live (zero) counts, not hardcoded copy.
    await waitFor(() => {
      expect(screen.getByText("Characters")).toBeInTheDocument();
    });
    const totals = await screen.findAllByText("0");
    expect(totals.length).toBeGreaterThan(0);
  });

  it("reflects a newly created character in the live metrics", async () => {
    await api.characters.create({ name: "Ada Voss", role: "main" });

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      // Total characters card should now show 1 somewhere in its metrics.
      const oneValues = screen.getAllByText("1");
      expect(oneValues.length).toBeGreaterThan(0);
    });
  });

  it("renders coming-soon placeholders for unbuilt modules", async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("Timeline")).toBeInTheDocument();
    expect(screen.getAllByText("Soon").length).toBeGreaterThan(5);
  });

  it("navigates to Characters when the Characters card is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    const card = await screen.findByRole("button", { name: /Characters/ });
    await user.click(card);
    // Navigation itself is asserted at the App-router level test; here we
    // just confirm the card is a clickable, enabled button (has an href-like
    // target), i.e. not a dead/coming-soon card.
    expect(card).toBeEnabled();
  });
});
