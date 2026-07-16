import { useState } from "react";
import { useCharacters } from "../../hooks/useCharacters";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { PARTICIPATES_IN } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface EventParticipantsProps {
  eventId: string;
}

/** Character participant picker for an event -- the mirror image of
 * RelationshipEditor.tsx (Phase 1), but fixed to the participates_in
 * relationship type and with source/target roles reversed (character is
 * always the source, event is always the target -- see
 * design-phase-2-timeline.md section 1 and FR2.1/FR5.3). */
export function EventParticipants({ eventId }: EventParticipantsProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(eventId);
  const { data: allCharacters = [] } = useCharacters();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [characterId, setCharacterId] = useState("");

  const participations = relationships.filter((r) => r.relationship_type === PARTICIPATES_IN);
  const participatingIds = new Set(participations.map((r) => r.source_entity_id));
  const candidates = allCharacters.filter((c) => !participatingIds.has(c.id));
  const characterById = new Map(allCharacters.map((c) => [c.id, c]));

  const handleAdd = () => {
    if (!characterId) return;
    createRelationship.mutate({
      source_entity_id: characterId,
      target_entity_id: eventId,
      relationship_type: PARTICIPATES_IN,
    });
    setCharacterId("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          className="flex-1"
        >
          <option value="">Add participant…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button
          variant="primary"
          onClick={handleAdd}
          disabled={!characterId || createRelationship.isPending}
        >
          Add
        </Button>
      </div>

      {participations.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No participants yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {participations.map((rel) => {
            const character = characterById.get(rel.source_entity_id);
            return (
              <li
                key={rel.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  {character?.name ?? "Unknown character"}
                </span>
                <button
                  onClick={() => deleteRelationship.mutate(rel.id)}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                  aria-label="Remove participant"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
