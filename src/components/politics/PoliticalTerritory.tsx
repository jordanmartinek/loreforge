import { useState } from "react";
import { useLocations } from "../../hooks/useLocations";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { CONTROLS } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface PoliticalTerritoryProps {
  entityId: string;
}

/** controls picker/list for locations (FR2.2/FR2.3) -- the political
 * entity is the relationship *source* here (political_entity ->
 * location), mirrors SpeciesHabitats.tsx/UnitStationing.tsx's "this
 * entity is the relationship source" shape. */
export function PoliticalTerritory({ entityId }: PoliticalTerritoryProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allLocations = [] } = useLocations();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const territoryLinks = relationships.filter(
    (r) => r.relationship_type === CONTROLS && r.source_entity_id === entityId,
  );
  const linkedLocationIds = new Set(territoryLinks.map((r) => r.target_entity_id));
  const locationById = new Map(allLocations.map((l) => [l.id, l]));
  const candidates = allLocations.filter((l) => !linkedLocationIds.has(l.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: entityId,
      target_entity_id: target,
      relationship_type: CONTROLS,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Add controlled territory…</option>
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

      {territoryLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No controlled territory yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {territoryLinks.map((rel) => (
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
                aria-label="Remove territory link"
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
