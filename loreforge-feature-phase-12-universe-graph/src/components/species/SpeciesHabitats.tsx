import { useState } from "react";
import { useLocations } from "../../hooks/useLocations";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { NATIVE_TO } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface SpeciesHabitatsProps {
  speciesId: string;
}

/** native_to picker/list for locations (FR4.2/FR4.3). Unlike
 * SpeciesMembers.tsx (where the species is the relationship *target*),
 * native_to has the species as the relationship *source* (species ->
 * location), so this component reads relationships where speciesId is the
 * source, not the target -- see design-phase-6-species.md section 3.3 for
 * why the two integration points look at opposite relationship sides. */
export function SpeciesHabitats({ speciesId }: SpeciesHabitatsProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(speciesId);
  const { data: allLocations = [] } = useLocations();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const habitatLinks = relationships.filter(
    (r) => r.relationship_type === NATIVE_TO && r.source_entity_id === speciesId,
  );
  const linkedLocationIds = new Set(habitatLinks.map((r) => r.target_entity_id));
  const locationById = new Map(allLocations.map((l) => [l.id, l]));
  const candidates = allLocations.filter((l) => !linkedLocationIds.has(l.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: speciesId,
      target_entity_id: target,
      relationship_type: NATIVE_TO,
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

      {habitatLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          No native locations recorded for this species yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {habitatLinks.map((rel) => (
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
                aria-label="Remove habitat link"
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
