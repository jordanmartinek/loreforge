import { useState } from "react";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { useTechnologies } from "../../hooks/useTechnologies";
import { EQUIPPED_WITH } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface UnitEquipmentProps {
  unitId: string;
}

/** equipped_with picker/list for technologies (FR4.3/FR4.4). Same shape
 * as UnitStationing.tsx (the unit is the relationship source), just
 * targeting technology instead of location. */
export function UnitEquipment({ unitId }: UnitEquipmentProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(unitId);
  const { data: allTechnologies = [] } = useTechnologies();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const equipmentLinks = relationships.filter(
    (r) => r.relationship_type === EQUIPPED_WITH && r.source_entity_id === unitId,
  );
  const linkedTechnologyIds = new Set(equipmentLinks.map((r) => r.target_entity_id));
  const technologyById = new Map(allTechnologies.map((t) => [t.id, t]));
  const candidates = allTechnologies.filter((t) => !linkedTechnologyIds.has(t.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: unitId,
      target_entity_id: target,
      relationship_type: EQUIPPED_WITH,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Link a technology…</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={handleAdd} disabled={!target || createRelationship.isPending}>
          Link
        </Button>
      </div>

      {equipmentLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          This unit isn't equipped with any technology yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {equipmentLinks.map((rel) => (
            <li
              key={rel.id}
              className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
            >
              <span className="font-medium text-[var(--color-text-primary)]">
                {technologyById.get(rel.target_entity_id)?.name ?? "Unknown"}
              </span>
              <button
                onClick={() => deleteRelationship.mutate(rel.id)}
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                aria-label="Remove equipment link"
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
