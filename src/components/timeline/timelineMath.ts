// Pure helper functions for positioning events along the timeline's time
// axis. Kept dependency-free and side-effect-free so they're trivially unit
// testable without mounting any React component.

import type { Event } from "../../lib/types";

export type TimelineZoom = "decade" | "year" | "month";

// Pixels-per-day at each zoom level. These are the only numbers that change
// when zooming -- event data is never refetched, only re-laid-out
// (requirements-phase-2-timeline.md FR3.3, NFR2).
export const PIXELS_PER_DAY: Record<TimelineZoom, number> = {
  decade: 0.6,
  year: 4,
  month: 24,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Converts an ISO date string to a day-count usable for linear positioning.
 * Returns NaN for unparseable input so callers can filter bad data instead
 * of crashing the timeline render. */
export function dateToDays(dateStr: string): number {
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return NaN;
  return ms / MS_PER_DAY;
}

export interface EventPosition {
  event: Event;
  x: number; // pixels from the timeline's left edge (day 0 = earliest event)
  width: number; // pixels; zero-duration events get a minimum visual width
}

const MIN_EVENT_WIDTH_PX = 8;

/** Lays out events left-to-right along the time axis at the given zoom's
 * pixels-per-day. `minDays` anchors x=0 (typically the earliest event's
 * start date) so positions stay stable as new events are added later. */
export function computeEventPositions(
  events: Event[],
  pixelsPerDay: number,
  minDays: number,
): EventPosition[] {
  return events
    .map((event) => {
      const startDays = dateToDays(event.start_date);
      if (Number.isNaN(startDays)) return null;
      const endDays = event.end_date ? dateToDays(event.end_date) : startDays;
      const durationDays = Number.isNaN(endDays) ? 0 : Math.max(0, endDays - startDays);
      return {
        event,
        x: (startDays - minDays) * pixelsPerDay,
        width: Math.max(MIN_EVENT_WIDTH_PX, durationDays * pixelsPerDay),
      };
    })
    .filter((p): p is EventPosition => p !== null);
}

/** Returns the minimum start-day across events, or 0 if there are none, so
 * an empty timeline has a well-defined origin. */
export function computeMinDays(events: Event[]): number {
  const days = events.map((e) => dateToDays(e.start_date)).filter((d) => !Number.isNaN(d));
  return days.length > 0 ? Math.min(...days) : 0;
}

/** Filters a laid-out event list down to only those whose horizontal span
 * intersects the visible scroll window (plus overscan on each side). This
 * is the mechanism that keeps DOM node count bounded regardless of total
 * event count (NFR2, "scale toward 25,000+ events without a rewrite") --
 * we only ever render what's near the viewport, not the whole dataset. */
export function filterVisibleEvents(
  positions: EventPosition[],
  scrollLeft: number,
  viewportWidth: number,
  overscanPx: number = 400,
): EventPosition[] {
  const visibleStart = scrollLeft - overscanPx;
  const visibleEnd = scrollLeft + viewportWidth + overscanPx;
  return positions.filter((p) => p.x + p.width >= visibleStart && p.x <= visibleEnd);
}

/** Converts a horizontal pixel delta (from a drag gesture) into a whole
 * number of days at the given zoom, so drag-to-reschedule always lands on
 * a clean date rather than a fractional day. */
export function pixelDeltaToDays(deltaPx: number, pixelsPerDay: number): number {
  return Math.round(deltaPx / pixelsPerDay);
}

/** Shifts an ISO date string by a number of days, returning a new ISO date
 * (YYYY-MM-DD) string. Used to commit a drag-to-reschedule gesture. */
export function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
