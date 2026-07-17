import { useOrganization, useOrganizations, useUpdateOrganization } from "../../hooks/useOrganizations";
import type { OrganizationPatch } from "../../lib/types";
import { ORGANIZATION_CLASSIFICATIONS } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Select } from "../ui/Select";
import { OrganizationLocations } from "./OrganizationLocations";
import { OrganizationMembers } from "./OrganizationMembers";
import { OrgDiplomaticRelations } from "./OrgDiplomaticRelations";

const CLASSIFICATION_LABELS: Record<string, string> = {
  guild: "Guild",
  corporation: "Corporation",
  syndicate: "Syndicate",
  secret_society: "Secret Society",
  trade_association: "Trade Association",
  criminal_enterprise: "Criminal Enterprise",
  other: "Other",
};

interface OrganizationDetailProps {
  organizationId: string;
}

export function OrganizationDetail({ organizationId }: OrganizationDetailProps) {
  const { data: organization, isLoading } = useOrganization(organizationId);
  const { data: allOrganizations = [] } = useOrganizations();
  const updateOrganization = useUpdateOrganization();

  if (isLoading || !organization) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: OrganizationPatch) => {
    updateOrganization.mutate({ id: organization.id, patch });
  };

  // "Set parent organization…" is a single-valued autosaved field, not a
  // relationship-picker interaction, since an organization has at most
  // one parent at the data-model level -- same shape as
  // ReligionDetail.tsx's/SpeciesDetail.tsx's parent picker. Excludes the
  // organization itself and its own direct subsidiaries as a
  // client-side UX nicety; organizations::update's backend
  // would_create_cycle check remains the authoritative guard.
  const subsidiaries = allOrganizations.filter((o) => o.parent_organization_id === organization.id);
  const directSubsidiaryIds = new Set(subsidiaries.map((o) => o.id));
  const parentCandidates = allOrganizations.filter(
    (o) => o.id !== organization.id && !directSubsidiaryIds.has(o.id),
  );
  const parent = allOrganizations.find((o) => o.id === organization.parent_organization_id);

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Name" value={organization.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="pt-5">
          <RevisionHistoryButton entityId={organization.id} entityName={organization.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Classification
          </label>
          <Select
            value={organization.classification}
            onChange={(e) => commit({ classification: e.target.value })}
          >
            {ORGANIZATION_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_LABELS[c] ?? c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Parent Organization
          </label>
          <Select
            value={organization.parent_organization_id ?? ""}
            onChange={(e) => commit({ parent_organization_id: e.target.value || null })}
          >
            <option value="">None (no parent organization)</option>
            {parentCandidates.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Section title="Charter">
        <AutosaveField
          label="Charter"
          value={organization.charter}
          onCommit={(charter) => commit({ charter })}
          multiline
        />
      </Section>

      <Section title="Structure">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Parent
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {parent ? parent.name : "None — this organization has no parent organization."}
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Subsidiaries
            </h4>
            {subsidiaries.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">No subsidiaries recorded.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {subsidiaries.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {o.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Members">
        <OrganizationMembers organizationId={organization.id} />
      </Section>

      <Section title="Locations of Operation">
        <OrganizationLocations organizationId={organization.id} />
      </Section>

      <Section title="Alliances & Rivalries">
        <OrgDiplomaticRelations entityId={organization.id} />
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
