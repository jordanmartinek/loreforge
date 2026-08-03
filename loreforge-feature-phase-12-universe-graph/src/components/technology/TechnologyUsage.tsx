import { useState } from "react";
import { useCharacters } from "../../hooks/useCharacters";
import { useEvents } from "../../hooks/useEvents";
import { useLocations } from "../../hooks/useLocations";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { USES_TECHNOLOGY } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface TechnologyUsageProps {
  technologyId: string;
}

/** uses_technology picker for a technology: shows which characters,
 * events, and locations use it, and allows adding/removing those links
 * (FR3.1-FR3.2). Generalizes LocationRelations.tsx's located_at picker
 * shape from two source entity types (character/event) to three
 * (character/event/location). */
export function TechnologyUsage({ technologyId }: TechnologyUsageProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(technologyId);
  const { data: allCharacters = [] } = useCharacters();
  const { data: allEvents = [] } = useEvents();
  const { data: allLocations = [] } = useLocations();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const usageLinks = relationships.filter((r) => r.relationship_type === USES_TECHNOLOGY);
  const linkedSourceIds = new Set(usageLinks.map((r) => r.source_entity_id));

  const characterById = new Map(allCharacters.map((c) => [c.id, c]));
  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const locationById = new Map(allLocations.map((l) => [l.id, l]));

  function resolveName(entityId: string): string {
    return (
      characterById.get(entityId)?.name ??
      eventById.get(entityId)?.name ??
      locationById.get(entityId)?.name ??
      "Unknown"
    );
  }

  const candidates = [
    ...allCharacters
      .filter((c) => !linkedSourceIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, kind: "Character" })),
    ...allEvents
      .filter((e) => !linkedSourceIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.name, kind: "Event" })),
    ...allLocations
      .filter((l) => !linkedSourceIds.has(l.id))
      .map((l) => ({ id: l.id, name: l.name, kind: "Location" })),
  ];

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: target,
      target_entity_id: technologyId,
      relationship_type: USES_TECHNOLOGY,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Link character, event, or location…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.kind})
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={handleAdd} disabled={!target || createRelationship.isPending}>
          Link
        </Button>
      </div>

      {usageLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Nothing uses this technology yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {usageLinks.map((rel) => (
            <li
              key={rel.id}
              className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
            >
              <span className="font-medium text-[var(--color-text-primary)]">
                {resolveName(rel.source_entity_id)}
              </span>
              <button
                onClick={() => deleteRelationship.mutate(rel.id)}
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                aria-label="Remove usage link"
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
