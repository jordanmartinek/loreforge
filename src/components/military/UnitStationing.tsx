import { useState } from "react";
import { useLocations } from "../../hooks/useLocations";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { STATIONED_AT } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface UnitStationingProps {
  unitId: string;
}

/** stationed_at picker/list for locations (FR4.2/FR4.4). The unit is the
 * relationship *source* here (military_unit -> location) -- mirrors
 * SpeciesHabitats.tsx's "this entity is the relationship source" shape. */
export function UnitStationing({ unitId }: UnitStationingProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(unitId);
  const { data: allLocations = [] } = useLocations();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const stationingLinks = relationships.filter(
    (r) => r.relationship_type === STATIONED_AT && r.source_entity_id === unitId,
  );
  const linkedLocationIds = new Set(stationingLinks.map((r) => r.target_entity_id));
  const locationById = new Map(allLocations.map((l) => [l.id, l]));
  const candidates = allLocations.filter((l) => !linkedLocationIds.has(l.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: unitId,
      target_entity_id: target,
      relationship_type: STATIONED_AT,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Link a location…</option>
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

      {stationingLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          This unit isn't stationed anywhere yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {stationingLinks.map((rel) => (
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
                aria-label="Remove stationing link"
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
