import { useCreateLocation, useLocationChildren } from "../../hooks/useLocations";
import type { Location } from "../../lib/types";
import { Button } from "../ui/Button";
import { LocationTreeNode } from "./LocationTreeNode";

interface WorldExplorerTreeProps {
  selectedId: string | null;
  onSelect: (location: Location) => void;
}

/** The primary Locations navigation surface: a collapsible tree rooted at
 * locations with no parent (FR5.1), distinct from Characters/Events/
 * Canon's flat virtualized lists because locations are inherently
 * hierarchical (design-phase-4-locations.md section 3.1). Only fetches
 * root-level locations up front; each LocationTreeNode fetches its own
 * children lazily. Creating a location as a child of a specific parent
 * (FR5.3) happens from LocationDetail's "+ Add Child" affordance instead of
 * here, since the parent needs to already be selected/open. */
export function WorldExplorerTree({ selectedId, onSelect }: WorldExplorerTreeProps) {
  const { data: rootLocations = [], isLoading } = useLocationChildren(null);
  const createLocation = useCreateLocation();

  const handleCreateAtRoot = async () => {
    const location = await createLocation.mutateAsync({ name: "New Location" });
    onSelect(location);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">World Explorer</h3>
        <Button
          variant="primary"
          onClick={handleCreateAtRoot}
          disabled={createLocation.isPending}
        >
          + New
        </Button>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
      ) : rootLocations.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">
          No locations yet. Create your first one above.
        </p>
      ) : (
        <div className="flex-1 overflow-auto rounded-md border border-[var(--color-border-subtle)] p-2">
          {rootLocations.map((location) => (
            <LocationTreeNode
              key={location.id}
              location={location}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
