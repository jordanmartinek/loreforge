import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import {
  useCreateOrganization,
  useDeleteOrganization,
  useOrganizations,
} from "../../hooks/useOrganizations";
import { ORGANIZATION_CLASSIFICATIONS, type Organization } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const CLASSIFICATION_LABELS: Record<string, string> = {
  guild: "Guild",
  corporation: "Corporation",
  syndicate: "Syndicate",
  secret_society: "Secret Society",
  trade_association: "Trade Association",
  criminal_enterprise: "Criminal Enterprise",
  other: "Other",
};

interface OrganizationListProps {
  selectedId: string | null;
  onSelect: (organization: Organization) => void;
}

/** Virtualized, filterable Organizations list -- reuses the flat-list
 * pattern from every prior phase, appropriate here even though subsidiary
 * structure is a strict tree at the data-model level: a worldbuilder
 * looks up an organization by name or browses by classification, then
 * inspects its place in the org chart from its own detail view -- the
 * tree is not the primary navigation surface (same design decision as
 * Species/Military/Religions). */
export function OrganizationList({ selectedId, onSelect }: OrganizationListProps) {
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("");

  const { data: organizations = [], isLoading } = useOrganizations({
    search: search || undefined,
    classification: classification || undefined,
  });

  const createOrganization = useCreateOrganization();
  const deleteOrganization = useDeleteOrganization();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: organizations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const handleCreate = async () => {
    const created = await createOrganization.mutateAsync({ name: "New Organization" });
    onSelect(created);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search organizations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={handleCreate} disabled={createOrganization.isPending}>
          + New
        </Button>
      </div>

      <Select value={classification} onChange={(e) => setClassification(e.target.value)}>
        <option value="">All classifications</option>
        {ORGANIZATION_CLASSIFICATIONS.map((c) => (
          <option key={c} value={c}>
            {CLASSIFICATION_LABELS[c] ?? c}
          </option>
        ))}
      </Select>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
      ) : organizations.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">
          No organizations yet. Create your first one above.
        </p>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto rounded-md border border-[var(--color-border-subtle)]"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = organizations[virtualRow.index];
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
                    onClick={() => deleteOrganization.mutate(entry.id)}
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
