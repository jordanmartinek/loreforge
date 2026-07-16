import { useTechnology, useUpdateTechnology } from "../../hooks/useTechnologies";
import type { TechnologyPatch } from "../../lib/types";
import { TECHNOLOGY_CATEGORIES } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { TechnologyDependencies } from "./TechnologyDependencies";
import { TechnologyUsage } from "./TechnologyUsage";

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

interface TechnologyDetailProps {
  technologyId: string;
}

export function TechnologyDetail({ technologyId }: TechnologyDetailProps) {
  const { data: technology, isLoading } = useTechnology(technologyId);
  const updateTechnology = useUpdateTechnology();

  if (isLoading || !technology) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: TechnologyPatch) => {
    updateTechnology.mutate({ id: technology.id, patch });
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Name" value={technology.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="pt-5">
          <RevisionHistoryButton entityId={technology.id} entityName={technology.name} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Category
          </label>
          <Select
            value={technology.category}
            onChange={(e) => commit({ category: e.target.value })}
          >
            {TECHNOLOGY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] ?? cat}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Introduced
          </label>
          <Input
            type="date"
            defaultValue={technology.introduced_date ?? ""}
            onBlur={(e) => commit({ introduced_date: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Date Precision
          </label>
          <Select
            value={technology.date_precision}
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

      <Section title="Description">
        <AutosaveField
          label="Description"
          value={technology.description}
          onCommit={(description) => commit({ description })}
          multiline
        />
      </Section>

      <Section title="Dependencies">
        <TechnologyDependencies technologyId={technology.id} />
      </Section>

      <Section title="Used By">
        <TechnologyUsage technologyId={technology.id} />
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
