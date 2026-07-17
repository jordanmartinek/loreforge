import { useState } from "react";
import { SpeciesDetail } from "../components/species/SpeciesDetail";
import { SpeciesList } from "../components/species/SpeciesList";
import type { Species } from "../lib/types";

export function SpeciesPage() {
  const [selected, setSelected] = useState<Species | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <SpeciesList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <SpeciesDetail speciesId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a species, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
