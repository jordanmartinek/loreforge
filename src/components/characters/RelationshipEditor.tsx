import { useState } from "react";
import { useCharacters } from "../../hooks/useCharacters";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import type { RelationshipType } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "friend",
  "enemy",
  "family",
  "mentor",
  "student",
  "political",
  "professional",
  "romantic",
  "unknown",
  "hidden",
];

interface RelationshipEditorProps {
  characterId: string;
}

export function RelationshipEditor({ characterId }: RelationshipEditorProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(characterId);
  const { data: allCharacters = [] } = useCharacters();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [targetId, setTargetId] = useState("");
  const [relType, setRelType] = useState<RelationshipType>("friend");

  const candidates = allCharacters.filter((c) => c.id !== characterId);
  const characterById = new Map(allCharacters.map((c) => [c.id, c]));

  const handleAdd = () => {
    if (!targetId) return;
    createRelationship.mutate({
      source_entity_id: characterId,
      target_entity_id: targetId,
      relationship_type: relType,
    });
    setTargetId("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="flex-1">
          <option value="">Connect to…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={relType}
          onChange={(e) => setRelType(e.target.value as RelationshipType)}
        >
          {RELATIONSHIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Button
          variant="primary"
          onClick={handleAdd}
          disabled={!targetId || createRelationship.isPending}
        >
          Link
        </Button>
      </div>

      {relationships.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No relationships yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {relationships.map((rel) => {
            const otherId =
              rel.source_entity_id === characterId ? rel.target_entity_id : rel.source_entity_id;
            const other = characterById.get(otherId);
            return (
              <li
                key={rel.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-[var(--color-text-tertiary)]">{rel.relationship_type}</span>
                  {"  →  "}
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {other?.name ?? "Unknown"}
                  </span>
                </span>
                <button
                  onClick={() => deleteRelationship.mutate(rel.id)}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                  aria-label="Remove relationship"
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
