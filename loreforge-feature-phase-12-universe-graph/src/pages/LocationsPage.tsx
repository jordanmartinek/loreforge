import { useState } from "react";
import { LocationDetail } from "../components/locations/LocationDetail";
import { WorldExplorerTree } from "../components/locations/WorldExplorerTree";
import type { Location } from "../lib/types";

export function LocationsPage() {
  const [selected, setSelected] = useState<Location | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <WorldExplorerTree selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <LocationDetail locationId={selected.id} onSelect={setSelected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a location in the tree, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
