import { useState } from "react";
import { CanonDetail } from "../components/canon/CanonDetail";
import { CanonList } from "../components/canon/CanonList";
import type { CanonEntry } from "../lib/types";

export function CanonPage() {
  const [selected, setSelected] = useState<CanonEntry | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <CanonList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <CanonDetail canonEntryId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a canon entry, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
