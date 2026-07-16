import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Event } from "../../lib/types";
import { pixelDeltaToDays, shiftDate } from "./timelineMath";

const LAYER_COLORS: Record<string, string> = {
  historical: "#7c7ff2",
  political: "#f2c14e",
  military: "#ef5d6f",
  technology: "#3ddc97",
  character_life: "#e879f9",
  wars: "#fb7185",
  books: "#60a5fa",
  screenplays: "#a3a3ff",
};

function primaryColorFor(event: Event): string {
  const firstLayer = event.layers[0];
  return firstLayer ? LAYER_COLORS[firstLayer] ?? "#9b9bab" : "#9b9bab";
}

interface EventCardProps {
  event: Event;
  x: number;
  width: number;
  pixelsPerDay: number;
  onClick: (event: Event) => void;
  onReschedule: (event: Event, newStartDate: string, newEndDate: string | null) => void;
}

/** A single event's visual block on the timeline. Implements
 * drag-to-reschedule via native pointer events (design-phase-2-timeline.md
 * section 3.2): the visual position updates on every pointermove for
 * instant feedback, but the actual date -- and therefore the single
 * revision-history entry and autosave write -- only commits on pointerup
 * (FR4.1, FR4.3). */
export function EventCard({ event, x, width, pixelsPerDay, onClick, onReschedule }: EventCardProps) {
  const [dragDeltaPx, setDragDeltaPx] = useState(0);
  const dragState = useRef<{ startPointerX: number; pointerId: number } | null>(null);
  const didDragRef = useRef(false);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Not every environment implements pointer capture (e.g. jsdom in
    // tests); feature-detect rather than assume, so drag-to-reschedule
    // degrades gracefully instead of throwing.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragState.current = { startPointerX: e.clientX, pointerId: e.pointerId };
    didDragRef.current = false;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const delta = e.clientX - dragState.current.startPointerX;
    if (Math.abs(delta) > 2) didDragRef.current = true;
    setDragDeltaPx(delta);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const deltaDays = pixelDeltaToDays(dragDeltaPx, pixelsPerDay);
    dragState.current = null;
    setDragDeltaPx(0);

    if (deltaDays !== 0) {
      const newStart = shiftDate(event.start_date, deltaDays);
      const newEnd = event.end_date ? shiftDate(event.end_date, deltaDays) : null;
      onReschedule(event, newStart, newEnd);
    } else if (!didDragRef.current) {
      onClick(event);
    }
  };

  const color = primaryColorFor(event);
  const isMajor = event.significance === "major";

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(event);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: "absolute",
        left: x + dragDeltaPx,
        width,
        borderColor: color,
        borderLeftWidth: 3,
      }}
      className={`top-1 flex h-9 cursor-grab items-center overflow-hidden rounded-md border
        bg-[var(--color-bg-2)] px-2 text-xs text-[var(--color-text-primary)] shadow-sm
        transition-shadow hover:shadow-md active:cursor-grabbing
        ${isMajor ? "font-semibold" : "font-normal"}`}
      title={`${event.name} (${event.start_date}${event.end_date ? ` – ${event.end_date}` : ""})`}
    >
      <span className="truncate">{event.name}</span>
    </div>
  );
}
