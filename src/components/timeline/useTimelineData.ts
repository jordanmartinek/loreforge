import { useMemo } from "react";
import { useEvents } from "../../hooks/useEvents";
import {
  PIXELS_PER_DAY,
  computeEventPositions,
  computeMinDays,
  type TimelineZoom,
} from "./timelineMath";

export function useTimelineData(activeLayers: Set<string>, zoom: TimelineZoom) {
  const { data: events = [], isLoading } = useEvents();

  const filteredEvents = useMemo(() => {
    if (activeLayers.size === 0) return events;
    return events.filter((event) => event.layers.some((layer) => activeLayers.has(layer)));
  }, [events, activeLayers]);

  const minDays = useMemo(() => computeMinDays(filteredEvents), [filteredEvents]);

  const positions = useMemo(
    () => computeEventPositions(filteredEvents, PIXELS_PER_DAY[zoom], minDays),
    [filteredEvents, zoom, minDays],
  );

  const totalWidth = useMemo(() => {
    if (positions.length === 0) return 0;
    return Math.max(...positions.map((p) => p.x + p.width)) + 200;
  }, [positions]);

  return { events: filteredEvents, positions, totalWidth, minDays, isLoading };
}
