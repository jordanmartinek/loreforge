import { useSpeciesEntry, useSpeciesList, useUpdateSpecies } from "../../hooks/useSpecies";
import type { SpeciesPatch } from "../../lib/types";
import { SPECIES_CLASSIFICATIONS } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Select } from "../ui/Select";
import { SpeciesHabitats } from "./SpeciesHabitats";
import { SpeciesMembers } from "./SpeciesMembers";

const CLASSIFICATION_LABELS: Record<string, string> = {
  sentient_humanoid: "Sentient Humanoid",
  sentient_non_humanoid: "Sentient Non-Humanoid",
  non_sentient_fauna: "Non-Sentient Fauna",
  non_sentient_flora: "Non-Sentient Flora",
  synthetic: "Synthetic",
  hybrid: "Hybrid",
  other: "Other",
};

interface SpeciesDetailProps {
  speciesId: string;
}

export function SpeciesDetail({ speciesId }: SpeciesDetailProps) {
  const { data: species, isLoading } = useSpeciesEntry(speciesId);
  const { data: allSpecies = [] } = useSpeciesList();
  const updateSpecies = useUpdateSpecies();

  if (isLoading || !species) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: SpeciesPatch) => {
    updateSpecies.mutate({ id: species.id, patch });
  };

  // "Set parent species…" is a single-valued autosaved field, not a
  // relationship-picker interaction, since a species has at most one
  // parent at the data-model level (design-phase-6-species.md section
  // 3.1) -- unlike TechnologyDependencies.tsx's multi-valued prerequisite
  // list. Excludes the species itself and its own direct subspecies as a
  // client-side UX nicety; species::update's backend would_create_cycle
  // check remains the authoritative guard (section 3.2).
  const subspecies = allSpecies.filter((s) => s.parent_species_id === species.id);
  const directSubspeciesIds = new Set(subspecies.map((s) => s.id));
  const parentCandidates = allSpecies.filter(
    (s) => s.id !== species.id && !directSubspeciesIds.has(s.id),
  );
  const parent = allSpecies.find((s) => s.id === species.parent_species_id);

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Name" value={species.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="pt-5">
          <RevisionHistoryButton entityId={species.id} entityName={species.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Classification
          </label>
          <Select
            value={species.classification}
            onChange={(e) => commit({ classification: e.target.value })}
          >
            {SPECIES_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_LABELS[c] ?? c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Parent Species
          </label>
          <Select
            value={species.parent_species_id ?? ""}
            onChange={(e) => commit({ parent_species_id: e.target.value || null })}
          >
            <option value="">None (root level)</option>
            {parentCandidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Section title="Biology">
        <AutosaveField
          label="Biology"
          value={species.biology}
          onCommit={(biology) => commit({ biology })}
          multiline
        />
      </Section>

      <Section title="Taxonomy">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Parent
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {parent ? parent.name : "None — this is a root-level species."}
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Subspecies
            </h4>
            {subspecies.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">No subspecies recorded.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {subspecies.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Members">
        <SpeciesMembers speciesId={species.id} />
      </Section>

      <Section title="Native Locations">
        <SpeciesHabitats speciesId={species.id} />
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
