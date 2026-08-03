import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import {
  useCreateTechnology,
  useDeleteTechnology,
  useTechnologies,
} from "../../hooks/useTechnologies";
import { TECHNOLOGY_CATEGORIES, type Technology } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const CATEGORY_LABELS: Record<string, string> = {
  ships: "Ships",
  weapons: "Weapons",
  power_systems: "Power Systems",
  communications: "Communications",
  medical: "Medical",
  artificial_intelligence: "Artificial Intelligence",
  void_technology: "Void Technology",
  military_doctrine: "Military Doctrine",
  other: "Other",
};

interface TechnologyListProps {
  selectedId: string | null;
  onSelect: (technology: Technology) => void;
}

/** Virtualized, filterable Technology Bible list -- reuses the flat-list
 * pattern from CharacterList.tsx rather than Locations' tree, since a
 * technology's dependency graph is inspected from its own detail view, not
 * used as the primary navigation surface (design-phase-5-technology.md
 * section 3.1). */
export function TechnologyList({ selectedId, onSelect }: TechnologyListProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const { data: technologies = [], isLoading } = useTechnologies({
    search: search || undefined,
    category: category || undefined,
  });

  const createTechnology = useCreateTechnology();
  const deleteTechnology = useDeleteTechnology();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: technologies.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const handleCreate = async () => {
    const technology = await createTechnology.mutateAsync({ name: "New Technology" });
    onSelect(technology);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search technology…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={handleCreate} disabled={createTechnology.isPending}>
          + New
        </Button>
      </div>

      <Select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All categories</option>
        {TECHNOLOGY_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {CATEGORY_LABELS[cat] ?? cat}
          </option>
        ))}
      </Select>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
      ) : technologies.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">
          No technologies yet. Create your first one above.
        </p>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto rounded-md border border-[var(--color-border-subtle)]"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const technology = technologies[virtualRow.index];
              const isSelected = technology.id === selectedId;
              return (
                <div
                  key={technology.id}
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
                    onClick={() => onSelect(technology)}
                    className="flex flex-1 flex-col items-start gap-1 py-2 text-left"
                  >
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {technology.name}
                    </span>
                    <Badge tone="neutral">{CATEGORY_LABELS[technology.category] ?? technology.category}</Badge>
                  </button>
                  <button
                    onClick={() => deleteTechnology.mutate(technology.id)}
                    className="hidden rounded-md px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] group-hover:block"
                    aria-label={`Delete ${technology.name}`}
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
