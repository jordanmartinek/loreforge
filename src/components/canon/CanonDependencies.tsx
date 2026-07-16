import { useState } from "react";
import { useCanonEntries } from "../../hooks/useCanon";
import { useCharacters } from "../../hooks/useCharacters";
import { useEvents } from "../../hooks/useEvents";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { DEPENDS_ON, RELATES_TO } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface CanonDependenciesProps {
  canonEntryId: string;
}

/** Dependency + relation picker for a canon entry (FR3.1/FR3.2): depends_on
 * links to other canon entries, relates_to links to characters or events.
 * Built on the same relationship CRUD hooks Phase 1/2 established --
 * RelationshipEditor.tsx and EventParticipants.tsx use the identical
 * pattern for their own relationship types. */
export function CanonDependencies({ canonEntryId }: CanonDependenciesProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(canonEntryId);
  const { data: allCanonEntries = [] } = useCanonEntries();
  const { data: allCharacters = [] } = useCharacters();
  const { data: allEvents = [] } = useEvents();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [dependsOnTarget, setDependsOnTarget] = useState("");
  const [relatesToTarget, setRelatesToTarget] = useState("");

  const canonById = new Map(allCanonEntries.map((c) => [c.id, c]));
  const characterById = new Map(allCharacters.map((c) => [c.id, c]));
  const eventById = new Map(allEvents.map((e) => [e.id, e]));

  function resolveName(entityId: string): string {
    return (
      canonById.get(entityId)?.name ??
      characterById.get(entityId)?.name ??
      eventById.get(entityId)?.name ??
      "Unknown"
    );
  }

  const dependsOnLinks = relationships.filter(
    (r) => r.relationship_type === DEPENDS_ON && r.source_entity_id === canonEntryId,
  );
  const relatesToLinks = relationships.filter((r) => r.relationship_type === RELATES_TO);

  const dependencyCandidates = allCanonEntries.filter(
    (c) => c.id !== canonEntryId && !dependsOnLinks.some((l) => l.target_entity_id === c.id),
  );

  const relatesToLinkedIds = new Set(
    relatesToLinks.map((l) => (l.source_entity_id === canonEntryId ? l.target_entity_id : l.source_entity_id)),
  );
  const relatesToCandidates = [
    ...allCharacters
      .filter((c) => !relatesToLinkedIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, kind: "Character" })),
    ...allEvents
      .filter((e) => !relatesToLinkedIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.name, kind: "Event" })),
  ];

  const handleAddDependsOn = () => {
    if (!dependsOnTarget) return;
    createRelationship.mutate({
      source_entity_id: canonEntryId,
      target_entity_id: dependsOnTarget,
      relationship_type: DEPENDS_ON,
    });
    setDependsOnTarget("");
  };

  const handleAddRelatesTo = () => {
    if (!relatesToTarget) return;
    createRelationship.mutate({
      source_entity_id: canonEntryId,
      target_entity_id: relatesToTarget,
      relationship_type: RELATES_TO,
    });
    setRelatesToTarget("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Depends On
        </h4>
        <div className="flex items-center gap-2">
          <Select
            value={dependsOnTarget}
            onChange={(e) => setDependsOnTarget(e.target.value)}
            className="flex-1"
          >
            <option value="">Depends on…</option>
            {dependencyCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            onClick={handleAddDependsOn}
            disabled={!dependsOnTarget || createRelationship.isPending}
          >
            Link
          </Button>
        </div>
        {dependsOnLinks.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">No dependencies yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {dependsOnLinks.map((rel) => (
              <li
                key={rel.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  {resolveName(rel.target_entity_id)}
                </span>
                <button
                  onClick={() => deleteRelationship.mutate(rel.id)}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                  aria-label="Remove dependency"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Related Characters / Events
        </h4>
        <div className="flex items-center gap-2">
          <Select
            value={relatesToTarget}
            onChange={(e) => setRelatesToTarget(e.target.value)}
            className="flex-1"
          >
            <option value="">Relate to…</option>
            {relatesToCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind})
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            onClick={handleAddRelatesTo}
            disabled={!relatesToTarget || createRelationship.isPending}
          >
            Link
          </Button>
        </div>
        {relatesToLinks.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">No related characters or events yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {relatesToLinks.map((rel) => {
              const otherId =
                rel.source_entity_id === canonEntryId ? rel.target_entity_id : rel.source_entity_id;
              return (
                <li
                  key={rel.id}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {resolveName(otherId)}
                  </span>
                  <button
                    onClick={() => deleteRelationship.mutate(rel.id)}
                    className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                    aria-label="Remove relation"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
