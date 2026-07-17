import { useState } from "react";
import { useCharacters } from "../../hooks/useCharacters";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { AFFILIATED_WITH } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface OrganizationMembersProps {
  organizationId: string;
}

/** affiliated_with picker/list for characters (FR4.1/FR4.3) -- mirrors
 * ReligionFollowers.tsx/PoliticalLeadership.tsx's picker shape directly. */
export function OrganizationMembers({ organizationId }: OrganizationMembersProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(organizationId);
  const { data: allCharacters = [] } = useCharacters();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const memberLinks = relationships.filter(
    (r) => r.relationship_type === AFFILIATED_WITH && r.target_entity_id === organizationId,
  );
  const linkedCharacterIds = new Set(memberLinks.map((r) => r.source_entity_id));
  const characterById = new Map(allCharacters.map((c) => [c.id, c]));
  const candidates = allCharacters.filter((c) => !linkedCharacterIds.has(c.id));

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: target,
      target_entity_id: organizationId,
      relationship_type: AFFILIATED_WITH,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Add an affiliated character…</option>
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

      {memberLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No affiliated members yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {memberLinks.map((rel) => (
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
                aria-label="Remove affiliated member"
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
