import { useState } from "react";
import { useLocationChildren } from "../../hooks/useLocations";
import type { Location } from "../../lib/types";

interface LocationTreeNodeProps {
  location: Location;
  selectedId: string | null;
  onSelect: (location: Location) => void;
  depth: number;
}

/** A single expandable row in the World Explorer tree. Fetches its own
 * children lazily via useLocationChildren, only once expanded -- see
 * design-phase-4-locations.md section 3.1 for why the tree is built this
 * way instead of loading the whole hierarchy up front. */
export function LocationTreeNode({ location, selectedId, onSelect, depth }: LocationTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: children = [] } = useLocationChildren(location.id, expanded);

  const isSelected = location.id === selectedId;

  return (
    <div>
      <div
        style={{ paddingLeft: depth * 16 }}
        className={`group flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm ${
          isSelected ? "bg-[var(--color-accent-muted)]" : "hover:bg-[var(--color-bg-2)]"
        }`}
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? `Collapse ${location.name}` : `Expand ${location.name}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] text-[var(--color-text-tertiary)]"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <button
          onClick={() => onSelect(location)}
          className="flex-1 truncate text-left text-[var(--color-text-primary)]"
        >
          {location.name}
        </button>
      </div>
      {expanded && (
        <div>
          {children.length === 0 ? (
            <p
              style={{ paddingLeft: (depth + 1) * 16 + 20 }}
              className="py-1 text-xs text-[var(--color-text-tertiary)]"
            >
              No child locations.
            </p>
          ) : (
            children.map((child) => (
              <LocationTreeNode
                key={child.id}
                location={child}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
