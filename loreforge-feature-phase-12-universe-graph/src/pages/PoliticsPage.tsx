import { useState } from "react";
import { PoliticalEntityDetail } from "../components/politics/PoliticalEntityDetail";
import { PoliticalEntityList } from "../components/politics/PoliticalEntityList";
import type { PoliticalEntity } from "../lib/types";

export function PoliticsPage() {
  const [selected, setSelected] = useState<PoliticalEntity | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <PoliticalEntityList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <PoliticalEntityDetail entityId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a political entity, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
