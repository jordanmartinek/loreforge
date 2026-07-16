import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { useCanonEntries, useCreateCanonEntry, useDeleteCanonEntry } from "../../hooks/useCanon";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import type { CanonEntry } from "../../lib/types";

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  approved: "success",
  deprecated: "danger",
  under_review: "warning",
  draft: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  under_review: "Under Review",
  draft: "Draft",
  deprecated: "Deprecated",
};

interface CanonListProps {
  selectedId: string | null;
  onSelect: (entry: CanonEntry) => void;
}

/** Virtualized canon entry list with status filtering, following the same
 * shape as Phase 1's CharacterList.tsx. */
export function CanonList({ selectedId, onSelect }: CanonListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data: entries = [], isLoading } = useCanonEntries({
    search: search || undefined,
    status: status || undefined,
  });

  const createCanonEntry = useCreateCanonEntry();
  const deleteCanonEntry = useDeleteCanonEntry();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const handleCreate = async () => {
    const entry = await createCanonEntry.mutateAsync({ name: "New Canon Entry" });
    onSelect(entry);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search canon…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={handleCreate} disabled={createCanonEntry.isPending}>
          + New
        </Button>
      </div>

      <Select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="under_review">Under Review</option>
        <option value="approved">Approved</option>
        <option value="deprecated">Deprecated</option>
      </Select>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">
          No canon entries yet. Create your first one above.
        </p>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto rounded-md border border-[var(--color-border-subtle)]"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = entries[virtualRow.index];
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
                    <span className="flex items-center gap-1.5">
                      <Badge tone={STATUS_TONE[entry.status] ?? "neutral"}>
                        {STATUS_LABEL[entry.status] ?? entry.status}
                      </Badge>
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">
                        v{entry.version}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => deleteCanonEntry.mutate(entry.id)}
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
