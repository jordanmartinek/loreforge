import { usePoliticalEntity, useUpdatePoliticalEntity } from "../../hooks/usePolitics";
import type { PoliticalEntityPatch } from "../../lib/types";
import { POLITICAL_CLASSIFICATIONS } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { DiplomaticRelations } from "./DiplomaticRelations";
import { PoliticalLeadership } from "./PoliticalLeadership";
import { PoliticalTerritory } from "./PoliticalTerritory";

const CLASSIFICATION_LABELS: Record<string, string> = {
  government: "Government",
  political_party: "Political Party",
  faction: "Faction",
  alliance: "Alliance",
  guild: "Guild",
  other: "Other",
};

interface PoliticalEntityDetailProps {
  entityId: string;
}

export function PoliticalEntityDetail({ entityId }: PoliticalEntityDetailProps) {
  const { data: entity, isLoading } = usePoliticalEntity(entityId);
  const updateEntity = useUpdatePoliticalEntity();

  if (isLoading || !entity) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: PoliticalEntityPatch) => {
    updateEntity.mutate({ id: entity.id, patch });
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Name" value={entity.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="pt-5">
          <RevisionHistoryButton entityId={entity.id} entityName={entity.name} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Classification
          </label>
          <Select
            value={entity.classification}
            onChange={(e) => commit({ classification: e.target.value })}
          >
            {POLITICAL_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_LABELS[c] ?? c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Founded
          </label>
          <Input
            type="date"
            defaultValue={entity.founded_date ?? ""}
            onBlur={(e) => commit({ founded_date: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Date Precision
          </label>
          <Select
            value={entity.date_precision}
            onChange={(e) => commit({ date_precision: e.target.value })}
          >
            <option value="century">Century</option>
            <option value="decade">Decade</option>
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="day">Day</option>
          </Select>
        </div>
      </div>

      <Section title="Ideology">
        <AutosaveField
          label="Ideology"
          value={entity.ideology}
          onCommit={(ideology) => commit({ ideology })}
          multiline
        />
      </Section>

      <Section title="Leadership">
        <PoliticalLeadership entityId={entity.id} />
      </Section>

      <Section title="Territory">
        <PoliticalTerritory entityId={entity.id} />
      </Section>

      <Section title="Diplomatic Relations">
        <DiplomaticRelations entityId={entity.id} />
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
