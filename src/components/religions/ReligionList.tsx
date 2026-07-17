import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { useCreateReligion, useDeleteReligion, useReligions } from "../../hooks/useReligions";
import { RELIGION_CLASSIFICATIONS, type Religion } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const CLASSIFICATION_LABELS: Record<string, string> = {
  organized_religion: "Organized Religion",
  folk_tradition: "Folk Tradition",
  cult: "Cult",
  philosophy: "Philosophy",
  pantheon_cult: "Pantheon Cult",
  other: "Other",
};

interface ReligionListProps {
  selectedId: string | null;
  onSelect: (religion: Religion) => void;
}

/** Virtualized, filterable Religions list -- reuses the flat-list
 * pattern from SpeciesList.tsx/MilitaryUnitList.tsx, appropriate here
 * even though schism structure is a strict tree at the data-model level:
 * a worldbuilder looks up a religion by name or browses by
 * classification, then inspects its parent/schisms from its own detail
 * view -- the tree is not the primary navigation surface (same design
 * decision as Phases 6/7). */
export function ReligionList({ selectedId, onSelect }: ReligionListProps) {
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("");

  const { data: religions = [], isLoading } = useReligions({
    search: search || undefined,
    classification: classification || undefined,
  });

  const createReligion = useCreateReligion();
  const deleteReligion = useDeleteReligion();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: religions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const handleCreate = async () => {
    const created = await createReligion.mutateAsync({ name: "New Religion" });
    onSelect(created);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search religions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={handleCreate} disabled={createReligion.isPending}>
          + New
        </Button>
      </div>

      <Select value={classification} onChange={(e) => setClassification(e.target.value)}>
        <option value="">All classifications</option>
        {RELIGION_CLASSIFICATIONS.map((c) => (
          <option key={c} value={c}>
            {CLASSIFICATION_LABELS[c] ?? c}
          </option>
        ))}
      </Select>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
      ) : religions.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">
          No religions yet. Create your first one above.
        </p>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto rounded-md border border-[var(--color-border-subtle)]"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = religions[virtualRow.index];
              const isSelected = entry.id === selectedId;
              return (
                <div
                  key={entry.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`group flex items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] px-3
                    ${isSelected ? "bg-[var(--color-accent-muted)]" : "hover:bg-[var(--color-bg-2)]"}`}
                >
                  <button
                    onClick={() => onSelect(entry)}
                    className="flex flex-1 flex-col items-start gap-1 py-2 text-left"
                  >
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {entry.name}
                    </span>
                    <Badge tone="neutral">
                      {CLASSIFICATION_LABELS[entry.classification] ?? entry.classification}
                    </Badge>
                  </button>
                  <button
                    onClick={() => deleteReligion.mutate(entry.id)}
                    className="hidden rounded-md px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] group-hover:block"
                    aria-label={`Delete ${entry.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
