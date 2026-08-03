import type { TimelineZoom } from "./timelineMath";

const ZOOM_LEVELS: { value: TimelineZoom; label: string }[] = [
  { value: "decade", label: "Decade" },
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
];

interface ZoomControlProps {
  zoom: TimelineZoom;
  onChange: (zoom: TimelineZoom) => void;
}

/** Rescales the timeline's pixels-per-day; never triggers a data refetch
 * (FR3.3) -- see TimelineView.tsx, which only recomputes layout on zoom
 * change. */
export function ZoomControl({ zoom, onChange }: ZoomControlProps) {
  return (
    <div className="flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] p-0.5">
      {ZOOM_LEVELS.map((level) => (
        <button
          key={level.value}
          onClick={() => onChange(level.value)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            zoom === level.value
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}
