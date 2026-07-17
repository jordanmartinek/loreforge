import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { useCreateMilitaryUnit, useDeleteMilitaryUnit, useMilitaryUnits } from "../../hooks/useMilitary";
import { MILITARY_BRANCHES, type MilitaryUnit } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const BRANCH_LABELS: Record<string, string> = {
  army: "Army",
  navy: "Navy",
  air_force: "Air Force",
  space_force: "Space Force",
  marines: "Marines",
  special_forces: "Special Forces",
  militia: "Militia",
  other: "Other",
};

interface MilitaryUnitListProps {
  selectedId: string | null;
  onSelect: (unit: MilitaryUnit) => void;
}

/** Virtualized, filterable Military list -- reuses the flat-list pattern
 * from SpeciesList.tsx/TechnologyList.tsx, NOT Locations' tree, even
 * though chain of command is a strict tree at the data-model level. A
 * worldbuilder looks up a unit by name or browses by branch, then
 * inspects its place in the chain of command from its own detail view --
 * the tree is not the primary navigation surface
 * (design-phase-7-military.md section 1). */
export function MilitaryUnitList({ selectedId, onSelect }: MilitaryUnitListProps) {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");

  const { data: units = [], isLoading } = useMilitaryUnits({
    search: search || undefined,
    branch: branch || undefined,
  });

  const createUnit = useCreateMilitaryUnit();
  const deleteUnit = useDeleteMilitaryUnit();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: units.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const handleCreate = async () => {
    const created = await createUnit.mutateAsync({ name: "New Unit" });
    onSelect(created);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search units…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={handleCreate} disabled={createUnit.isPending}>
          + New
        </Button>
      </div>

      <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
        <option value="">All branches</option>
        {MILITARY_BRANCHES.map((b) => (
          <option key={b} value={b}>
            {BRANCH_LABELS[b] ?? b}
          </option>
        ))}
      </Select>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
      ) : units.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">
          No military units yet. Create your first one above.
        </p>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto rounded-md border border-[var(--color-border-subtle)]"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = units[virtualRow.index];
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
                    <Badge tone="neutral">{BRANCH_LABELS[entry.branch] ?? entry.branch}</Badge>
                  </button>
                  <button
                    onClick={() => deleteUnit.mutate(entry.id)}
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
