import { useState } from "react";
import { useLocations } from "../../hooks/useLocations";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { HOLY_SITE } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface ReligionHolySitesProps {
  religionId: string;
}

/** holy_site picker/list for locations (FR4.2/FR4.3). The religion is the
 * relationship *source* here (religion -> location), mirrors
 * SpeciesHabitats.tsx/UnitStationing.tsx/PoliticalTerritory.tsx's "this
 * entity is the relationship source" shape. */
export function ReligionHolySites({ religionId }: ReligionHolySitesProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(religionId);
  const { data: allLocations = [] } = useLocations();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const holySiteLinks = relationships.filter(
    (r) => r.relationship_type === HOLY_SITE && r.source_entity_id === religionId,
  );
  const linkedLocationIds = new Set(holySiteLinks.map((r) => r.target_entity_id));
  const locationById = new Map(allLocations.map((l) => [l.id, l]));
  const candidates = allLocations.filter((l) => !linkedLocationIds.has(l.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: religionId,
      target_entity_id: target,
      relationship_type: HOLY_SITE,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Add a holy site…</option>
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

      {holySiteLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No holy sites recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {holySiteLinks.map((rel) => (
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
                aria-label="Remove holy site"
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
