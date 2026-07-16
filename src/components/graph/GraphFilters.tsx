// Generic entity-type filter bar. Only "character" exists in Phase 1, but
// the list-driven structure means adding "location", "technology", etc.
// later is a one-line data change (design.md FR5.4 / section 5).

interface EntityTypeOption {
  type: string;
  label: string;
}

const ENTITY_TYPE_OPTIONS: EntityTypeOption[] = [{ type: "character", label: "Characters" }];

interface GraphFiltersProps {
  activeTypes: Set<string>;
  onToggle: (type: string) => void;
}

export function GraphFilters({ activeTypes, onToggle }: GraphFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      {ENTITY_TYPE_OPTIONS.map((opt) => {
        const active = activeTypes.has(opt.type);
        return (
          <button
            key={opt.type}
            onClick={() => onToggle(opt.type)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]"
                : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      <span className="text-xs text-[var(--color-text-tertiary)]">
        More node types arrive in later phases.
      </span>
    </div>
  );
}
