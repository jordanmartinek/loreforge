import { useState } from "react";
import { TechnologyDetail } from "../components/technology/TechnologyDetail";
import { TechnologyList } from "../components/technology/TechnologyList";
import type { Technology } from "../lib/types";

export function TechnologyPage() {
  const [selected, setSelected] = useState<Technology | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <TechnologyList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <TechnologyDetail technologyId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a technology, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
