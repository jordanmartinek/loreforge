import { useState } from "react";
import { useLocations } from "../../hooks/useLocations";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { OPERATES_AT } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface OrganizationLocationsProps {
  organizationId: string;
}

/** operates_at picker/list for locations (FR4.2/FR4.3). The organization
 * is the relationship *source* here (organization -> location), mirrors
 * ReligionHolySites.tsx/PoliticalTerritory.tsx's "this entity is the
 * relationship source" shape. */
export function OrganizationLocations({ organizationId }: OrganizationLocationsProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(organizationId);
  const { data: allLocations = [] } = useLocations();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const locationLinks = relationships.filter(
    (r) => r.relationship_type === OPERATES_AT && r.source_entity_id === organizationId,
  );
  const linkedLocationIds = new Set(locationLinks.map((r) => r.target_entity_id));
  const locationById = new Map(allLocations.map((l) => [l.id, l]));
  const candidates = allLocations.filter((l) => !linkedLocationIds.has(l.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: organizationId,
      target_entity_id: target,
      relationship_type: OPERATES_AT,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Add a location of operation…</option>
          {candidates.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={handleAdd} disabled={!target || createRelationship.isPending}>
          Link
        </Button>
      </div>

      {locationLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          This organization doesn't operate anywhere yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {locationLinks.map((rel) => (
            <li
              key={rel.id}
              className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
            >
              <span className="font-medium text-[var(--color-text-primary)]">
                {locationById.get(rel.target_entity_id)?.name ?? "Unknown"}
              </span>
              <button
                onClick={() => deleteRelationship.mutate(rel.id)}
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                aria-label="Remove location of operation"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
