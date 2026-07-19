// Entity-type filter bar / legend. Phase 12 extends this from
// Character-only (Phase 1) to all 10 entity types, driven by the shared
// lib/entityTypes.ts registry -- adding an 11th entity type in a future
// phase is a one-line addition to that registry, not a change here
// (design-phase-12-universe-graph.md section 2.3, continuing the
// extensibility promise Phase 1's design.md section 5 originally made).
// Each toggle's swatch uses that type's ENTITY_TYPE_COLORS entry, so this
// bar doubles as the graph's color legend (FR1.3) -- there's no separate
// legend component to keep in sync with the node-coloring logic.

import { ENTITY_TYPE_COLORS, ENTITY_TYPE_KEYS, ENTITY_TYPE_LABELS } from "../../lib/entityTypes";
import type { EntityTypeKey } from "../../lib/entityTypes";

interface GraphFiltersProps {
  activeTypes: Set<EntityTypeKey>;
  onToggle: (type: EntityTypeKey) => void;
}

export function GraphFilters({ activeTypes, onToggle }: GraphFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ENTITY_TYPE_KEYS.map((type) => {
        const active = activeTypes.has(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]"
                : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: ENTITY_TYPE_COLORS[type], opacity: active ? 1 : 0.4 }}
            />
            {ENTITY_TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}
