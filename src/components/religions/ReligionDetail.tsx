import { useReligion, useReligions, useUpdateReligion } from "../../hooks/useReligions";
import type { ReligionPatch } from "../../lib/types";
import { RELIGION_CLASSIFICATIONS } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Select } from "../ui/Select";
import { ReligionFollowers } from "./ReligionFollowers";
import { ReligionHolySites } from "./ReligionHolySites";

const CLASSIFICATION_LABELS: Record<string, string> = {
  organized_religion: "Organized Religion",
  folk_tradition: "Folk Tradition",
  cult: "Cult",
  philosophy: "Philosophy",
  pantheon_cult: "Pantheon Cult",
  other: "Other",
};

interface ReligionDetailProps {
  religionId: string;
}

export function ReligionDetail({ religionId }: ReligionDetailProps) {
  const { data: religion, isLoading } = useReligion(religionId);
  const { data: allReligions = [] } = useReligions();
  const updateReligion = useUpdateReligion();

  if (isLoading || !religion) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: ReligionPatch) => {
    updateReligion.mutate({ id: religion.id, patch });
  };

  // "Set parent religion…" is a single-valued autosaved field, not a
  // relationship-picker interaction, since a religion has at most one
  // parent in its schism tree at the data-model level (mirrors
  // SpeciesDetail.tsx/MilitaryUnitDetail.tsx's parent picker shape).
  // Excludes the religion itself and its own direct schisms as a
  // client-side UX nicety; religions::update's backend
  // would_create_cycle check remains the authoritative guard.
  const schisms = allReligions.filter((r) => r.parent_religion_id === religion.id);
  const directSchismIds = new Set(schisms.map((r) => r.id));
  const parentCandidates = allReligions.filter(
    (r) => r.id !== religion.id && !directSchismIds.has(r.id),
  );
  const parent = allReligions.find((r) => r.id === religion.parent_religion_id);

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Name" value={religion.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="pt-5">
          <RevisionHistoryButton entityId={religion.id} entityName={religion.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Classification
          </label>
          <Select
            value={religion.classification}
            onChange={(e) => commit({ classification: e.target.value })}
          >
            {RELIGION_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_LABELS[c] ?? c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Parent Religion
          </label>
          <Select
            value={religion.parent_religion_id ?? ""}
            onChange={(e) => commit({ parent_religion_id: e.target.value || null })}
          >
            <option value="">None (root tradition)</option>
            {parentCandidates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Section title="Tenets">
        <AutosaveField
          label="Tenets"
          value={religion.tenets}
          onCommit={(tenets) => commit({ tenets })}
          multiline
        />
      </Section>

      <Section title="Schisms & Denominations">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Parent
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {parent ? parent.name : "None — this is a root tradition."}
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Schisms
            </h4>
            {schisms.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">No schisms recorded.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {schisms.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {r.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Followers">
        <ReligionFollowers religionId={religion.id} />
      </Section>

      <Section title="Holy Sites">
        <ReligionHolySites religionId={religion.id} />
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
