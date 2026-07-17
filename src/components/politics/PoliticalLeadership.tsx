import { useState } from "react";
import { useCharacters } from "../../hooks/useCharacters";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { LEADS } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface PoliticalLeadershipProps {
  entityId: string;
}

/** leads picker/list for characters (FR2.1/FR2.3) -- mirrors
 * SpeciesMembers.tsx/UnitPersonnel.tsx's picker shape directly. */
export function PoliticalLeadership({ entityId }: PoliticalLeadershipProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allCharacters = [] } = useCharacters();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const leadershipLinks = relationships.filter(
    (r) => r.relationship_type === LEADS && r.target_entity_id === entityId,
  );
  const linkedCharacterIds = new Set(leadershipLinks.map((r) => r.source_entity_id));
  const characterById = new Map(allCharacters.map((c) => [c.id, c]));
  const candidates = allCharacters.filter((c) => !linkedCharacterIds.has(c.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: target,
      target_entity_id: entityId,
      relationship_type: LEADS,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Set a leader…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={handleAdd} disabled={!target || createRelationship.isPending}>
          Link
        </Button>
      </div>

      {leadershipLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No leader set yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {leadershipLinks.map((rel) => (
            <li
              key={rel.id}
              className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
            >
              <span className="font-medium text-[var(--color-text-primary)]">
                {characterById.get(rel.source_entity_id)?.name ?? "Unknown"}
              </span>
              <button
                onClick={() => deleteRelationship.mutate(rel.id)}
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                aria-label="Remove leader"
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
