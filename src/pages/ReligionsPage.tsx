import { useState } from "react";
import { ReligionDetail } from "../components/religions/ReligionDetail";
import { ReligionList } from "../components/religions/ReligionList";
import type { Religion } from "../lib/types";

export function ReligionsPage() {
  const [selected, setSelected] = useState<Religion | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <ReligionList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <ReligionDetail religionId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a religion, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
