// Multi-select layer filter, following the same pill-button visual pattern
// as GraphFilters.tsx (Phase 1). Unlike GraphFilters (which filters entity
// *types*), this filters event *layers*, but the interaction model is
// identical -- deliberately reusing a proven pattern (FR3.2).

import { EVENT_LAYERS } from "../../lib/types";

const LAYER_LABELS: Record<string, string> = {
  historical: "Historical",
  political: "Political",
  military: "Military",
  technology: "Technology",
  character_life: "Character Life",
  wars: "Wars",
  books: "Books",
  screenplays: "Screenplays",
};

interface TimelineLayerFilterProps {
  activeLayers: Set<string>;
  onToggle: (layer: string) => void;
}

export function TimelineLayerFilter({ activeLayers, onToggle }: TimelineLayerFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {EVENT_LAYERS.map((layer) => {
        const active = activeLayers.has(layer);
        return (
          <button
            key={layer}
            onClick={() => onToggle(layer)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]"
                : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {LAYER_LABELS[layer] ?? layer}
          </button>
        );
      })}
    </div>
  );
}
