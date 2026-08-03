import { useEffect, useRef, useState } from "react";
import { useUpdateEvent } from "../../hooks/useEvents";
import type { Event } from "../../lib/types";
import { EventCard } from "./EventCard";
import { EventDetailPanel } from "./EventDetailPanel";
import { TimelineLayerFilter } from "./TimelineLayerFilter";
import { ZoomControl } from "./ZoomControl";
import { PIXELS_PER_DAY, filterVisibleEvents, type TimelineZoom } from "./timelineMath";
import { useTimelineData } from "./useTimelineData";
import { Button } from "../ui/Button";

export function TimelineView() {
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<TimelineZoom>("year");
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1000);
  const [selectedEvent, setSelectedEvent] = useState<Event | "new" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { positions, totalWidth, isLoading } = useTimelineData(activeLayers, zoom);
  const updateEvent = useUpdateEvent();

  const toggleLayer = (layer: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrollLeft(scrollRef.current.scrollLeft);
      setViewportWidth(scrollRef.current.clientWidth);
    }
  };

  // Measure the real viewport width as soon as the scroll container mounts
  // (and whenever the event list changes size), rather than relying on the
  // `viewportWidth` default guess -- otherwise events that are on-screen
  // before the user ever scrolls could be incorrectly windowed out.
  useEffect(() => {
    if (scrollRef.current) {
      setViewportWidth(scrollRef.current.clientWidth || scrollRef.current.offsetWidth);
    }
  }, [positions.length]);

  const handleReschedule = (event: Event, newStartDate: string, newEndDate: string | null) => {
    updateEvent.mutate({
      id: event.id,
      patch: { start_date: newStartDate, end_date: newEndDate },
    });
  };

  // Windowing: only render events whose horizontal span intersects the
  // visible scroll area (plus overscan). This is what keeps DOM node count
  // bounded regardless of total event count, per NFR2 -- see
  // timelineMath.ts's filterVisibleEvents and its scale test.
  const visiblePositions = filterVisibleEvents(positions, scrollLeft, viewportWidth);

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading timeline…</p>;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <TimelineLayerFilter activeLayers={activeLayers} onToggle={toggleLayer} />
        <div className="flex items-center gap-3">
          <ZoomControl zoom={zoom} onChange={setZoom} />
          <Button variant="primary" onClick={() => setSelectedEvent("new")}>
            + New Event
          </Button>
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No events yet{activeLayers.size > 0 ? " for the active layer filter" : ""}. Create your
          first event above.
        </p>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-x-auto overflow-y-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)]"
        >
          <div style={{ position: "relative", width: totalWidth, height: "100%", minHeight: 200 }}>
            {visiblePositions.map(({ event, x, width }) => (
              <EventCard
                key={event.id}
                event={event}
                x={x}
                width={width}
                pixelsPerDay={PIXELS_PER_DAY[zoom]}
                onClick={setSelectedEvent}
                onReschedule={handleReschedule}
              />
            ))}
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent === "new" ? null : selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
