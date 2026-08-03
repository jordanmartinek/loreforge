import { describe, expect, it } from "vitest";
import {
  PIXELS_PER_DAY,
  computeEventPositions,
  computeMinDays,
  dateToDays,
  filterVisibleEvents,
  pixelDeltaToDays,
  shiftDate,
} from "./timelineMath";
import type { Event } from "../../lib/types";

function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: "id-1",
    name: "Test Event",
    description: "",
    layers: [],
    start_date: "2140-01-01",
    end_date: null,
    date_precision: "day",
    significance: "minor",
    created_at: "2140-01-01T00:00:00.000Z",
    updated_at: "2140-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dateToDays", () => {
  it("is monotonic: later dates produce larger day counts", () => {
    expect(dateToDays("2140-01-02")).toBeGreaterThan(dateToDays("2140-01-01"));
  });

  it("returns NaN for unparseable dates", () => {
    expect(Number.isNaN(dateToDays("not-a-date"))).toBe(true);
  });
});

describe("computeMinDays", () => {
  it("returns 0 for an empty event list", () => {
    expect(computeMinDays([])).toBe(0);
  });

  it("returns the earliest start date across events", () => {
    const events = [
      makeEvent({ id: "a", start_date: "2150-01-01" }),
      makeEvent({ id: "b", start_date: "2100-01-01" }),
      makeEvent({ id: "c", start_date: "2125-01-01" }),
    ];
    expect(computeMinDays(events)).toBe(dateToDays("2100-01-01"));
  });
});

describe("computeEventPositions", () => {
  it("positions the anchor (earliest) event at x=0", () => {
    const events = [makeEvent({ id: "a", start_date: "2100-01-01" })];
    const minDays = computeMinDays(events);
    const positions = computeEventPositions(events, PIXELS_PER_DAY.year, minDays);
    expect(positions[0].x).toBe(0);
  });

  it("orders later events at a larger x than earlier ones", () => {
    const events = [
      makeEvent({ id: "a", start_date: "2100-01-01" }),
      makeEvent({ id: "b", start_date: "2110-01-01" }),
    ];
    const minDays = computeMinDays(events);
    const positions = computeEventPositions(events, PIXELS_PER_DAY.year, minDays);
    const a = positions.find((p) => p.event.id === "a")!;
    const b = positions.find((p) => p.event.id === "b")!;
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("gives duration-spanning events a width proportional to their span", () => {
    const events = [makeEvent({ id: "a", start_date: "2100-01-01", end_date: "2102-01-01" })];
    const shortEvents = [makeEvent({ id: "b", start_date: "2100-01-01", end_date: "2100-01-02" })];
    const minDays = computeMinDays(events);
    const [{ width: longWidth }] = computeEventPositions(events, PIXELS_PER_DAY.year, minDays);
    const [{ width: shortWidth }] = computeEventPositions(shortEvents, PIXELS_PER_DAY.year, minDays);
    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  it("gives instantaneous events at least the minimum visual width", () => {
    const events = [makeEvent({ id: "a", start_date: "2100-01-01" })];
    const minDays = computeMinDays(events);
    const [{ width }] = computeEventPositions(events, PIXELS_PER_DAY.year, minDays);
    expect(width).toBeGreaterThan(0);
  });

  it("skips events with unparseable dates instead of crashing", () => {
    const events = [
      makeEvent({ id: "a", start_date: "garbage" }),
      makeEvent({ id: "b", start_date: "2100-01-01" }),
    ];
    const positions = computeEventPositions(events, PIXELS_PER_DAY.year, 0);
    expect(positions).toHaveLength(1);
    expect(positions[0].event.id).toBe("b");
  });
});

describe("zoom levels rescale layout without needing new data", () => {
  it("produces a larger x for the same event at a more zoomed-in level", () => {
    const events = [
      makeEvent({ id: "a", start_date: "2100-01-01" }),
      makeEvent({ id: "b", start_date: "2110-01-01" }),
    ];
    const minDays = computeMinDays(events);
    const atDecade = computeEventPositions(events, PIXELS_PER_DAY.decade, minDays);
    const atMonth = computeEventPositions(events, PIXELS_PER_DAY.month, minDays);
    const bAtDecade = atDecade.find((p) => p.event.id === "b")!;
    const bAtMonth = atMonth.find((p) => p.event.id === "b")!;
    expect(bAtMonth.x).toBeGreaterThan(bAtDecade.x);
  });
});

describe("filterVisibleEvents", () => {
  it("keeps only events intersecting the viewport plus overscan", () => {
    const positions = [
      { event: makeEvent({ id: "far-left" }), x: -10000, width: 10 },
      { event: makeEvent({ id: "in-view" }), x: 500, width: 10 },
      { event: makeEvent({ id: "far-right" }), x: 100000, width: 10 },
    ];
    const visible = filterVisibleEvents(positions, 0, 1000, 200);
    expect(visible.map((p) => p.event.id)).toEqual(["in-view"]);
  });

  it("never grows unbounded with total event count -- only viewport-relative window matters", () => {
    const positions = Array.from({ length: 25000 }, (_, i) => ({
      event: makeEvent({ id: `e${i}` }),
      x: i * 100,
      width: 10,
    }));
    const visible = filterVisibleEvents(positions, 500000, 1000, 200);
    // Only a small window around scrollLeft=500000 should survive, not all
    // 25,000 -- this is what keeps rendering bounded at scale (NFR2).
    expect(visible.length).toBeLessThan(50);
  });
});

describe("pixelDeltaToDays / shiftDate (drag-to-reschedule)", () => {
  it("rounds pixel deltas to whole days", () => {
    expect(pixelDeltaToDays(10, PIXELS_PER_DAY.year)).toBe(Math.round(10 / PIXELS_PER_DAY.year));
  });

  it("shifts a date forward and backward correctly", () => {
    expect(shiftDate("2140-01-01", 5)).toBe("2140-01-06");
    expect(shiftDate("2140-01-10", -5)).toBe("2140-01-05");
  });

  it("shifting by zero days is a no-op", () => {
    expect(shiftDate("2140-06-15", 0)).toBe("2140-06-15");
  });
});
