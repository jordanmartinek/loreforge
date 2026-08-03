import { useMilitaryUnit, useMilitaryUnits, useUpdateMilitaryUnit } from "../../hooks/useMilitary";
import type { MilitaryUnitPatch } from "../../lib/types";
import { MILITARY_BRANCHES } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Select } from "../ui/Select";
import { UnitEquipment } from "./UnitEquipment";
import { UnitPersonnel } from "./UnitPersonnel";
import { UnitStationing } from "./UnitStationing";

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

interface MilitaryUnitDetailProps {
  unitId: string;
}

export function MilitaryUnitDetail({ unitId }: MilitaryUnitDetailProps) {
  const { data: unit, isLoading } = useMilitaryUnit(unitId);
  const { data: allUnits = [] } = useMilitaryUnits();
  const updateUnit = useUpdateMilitaryUnit();

  if (isLoading || !unit) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: MilitaryUnitPatch) => {
    updateUnit.mutate({ id: unit.id, patch });
  };

  // "Set parent unit…" is a single-valued autosaved field, not a
  // relationship-picker interaction, since a unit has at most one parent
  // in its chain of command at the data-model level
  // (design-phase-7-military.md section 1) -- same shape as
  // SpeciesDetail.tsx's parent-species picker. Excludes the unit itself
  // and its own direct subordinates as a client-side UX nicety;
  // military::update's backend would_create_cycle check remains the
  // authoritative guard.
  const subordinates = allUnits.filter((u) => u.parent_unit_id === unit.id);
  const directSubordinateIds = new Set(subordinates.map((u) => u.id));
  const parentCandidates = allUnits.filter(
    (u) => u.id !== unit.id && !directSubordinateIds.has(u.id),
  );
  const parent = allUnits.find((u) => u.id === unit.parent_unit_id);

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Name" value={unit.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="pt-5">
          <RevisionHistoryButton entityId={unit.id} entityName={unit.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Branch
          </label>
          <Select value={unit.branch} onChange={(e) => commit({ branch: e.target.value })}>
            {MILITARY_BRANCHES.map((b) => (
              <option key={b} value={b}>
                {BRANCH_LABELS[b] ?? b}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Parent Unit
          </label>
          <Select
            value={unit.parent_unit_id ?? ""}
            onChange={(e) => commit({ parent_unit_id: e.target.value || null })}
          >
            <option value="">None (top of chain of command)</option>
            {parentCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Section title="Doctrine">
        <AutosaveField
          label="Doctrine"
          value={unit.doctrine}
          onCommit={(doctrine) => commit({ doctrine })}
          multiline
        />
      </Section>

      <Section title="Chain of Command">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Parent Unit
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {parent ? parent.name : "None — this unit is at the top of its chain of command."}
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Subordinate Units
            </h4>
            {subordinates.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">No subordinate units recorded.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {subordinates.map((u) => (
                  <li
                    key={u.id}
                    className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {u.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Personnel">
        <UnitPersonnel unitId={unit.id} />
      </Section>

      <Section title="Stationed At">
        <UnitStationing unitId={unit.id} />
      </Section>

      <Section title="Equipment">
        <UnitEquipment unitId={unit.id} />
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
