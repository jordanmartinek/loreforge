import { useCanonEntry, useUpdateCanonEntry } from "../../hooks/useCanon";
import type { CanonEntryPatch } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Select } from "../ui/Select";
import { CanonDependencies } from "./CanonDependencies";

interface CanonDetailProps {
  canonEntryId: string;
}

export function CanonDetail({ canonEntryId }: CanonDetailProps) {
  const { data: entry, isLoading } = useCanonEntry(canonEntryId);
  const updateCanonEntry = useUpdateCanonEntry();

  if (isLoading || !entry) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: CanonEntryPatch) => {
    updateCanonEntry.mutate({ id: entry.id, patch });
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Title" value={entry.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="flex flex-col items-end gap-2 pt-5">
          <span className="text-xs text-[var(--color-text-tertiary)]">Version {entry.version}</span>
          <RevisionHistoryButton entityId={entry.id} entityName={entry.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Status
          </label>
          <Select value={entry.status} onChange={(e) => commit({ status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="deprecated">Deprecated</option>
          </Select>
        </div>
        <AutosaveField
          label="Category"
          value={entry.category}
          onCommit={(category) => commit({ category })}
          placeholder="e.g. Void Technology"
        />
      </div>

      <Section title="Description">
        <AutosaveField
          label="Description"
          value={entry.description}
          onCommit={(description) => commit({ description })}
          multiline
        />
      </Section>

      <Section title="Notes">
        <AutosaveField label="Notes" value={entry.notes} onCommit={(notes) => commit({ notes })} multiline />
      </Section>

      <Section title="Dependencies & Relations">
        <CanonDependencies canonEntryId={entry.id} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </div>
  );
}
