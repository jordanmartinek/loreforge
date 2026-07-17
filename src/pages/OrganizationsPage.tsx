import { useState } from "react";
import { OrganizationDetail } from "../components/organizations/OrganizationDetail";
import { OrganizationList } from "../components/organizations/OrganizationList";
import type { Organization } from "../lib/types";

export function OrganizationsPage() {
  const [selected, setSelected] = useState<Organization | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <OrganizationList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <OrganizationDetail organizationId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select an organization, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
