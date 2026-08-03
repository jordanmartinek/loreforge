import { useState } from "react";
import { MilitaryUnitDetail } from "../components/military/MilitaryUnitDetail";
import { MilitaryUnitList } from "../components/military/MilitaryUnitList";
import type { MilitaryUnit } from "../lib/types";

export function MilitaryPage() {
  const [selected, setSelected] = useState<MilitaryUnit | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <MilitaryUnitList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <MilitaryUnitDetail unitId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a military unit, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
