import { useState } from "react";
import { useCharacters } from "../../hooks/useCharacters";
import { useEvents } from "../../hooks/useEvents";
import {
  useCreateRelationship,
  useDeleteRelationship,
  useRelationshipsForEntity,
} from "../../hooks/useRelationships";
import { LOCATED_AT } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface LocationRelationsProps {
  locationId: string;
}

/** located_at picker for a location: shows which characters and events are
 * linked to it, and allows adding/removing those links (FR4.1-FR4.3).
 * Characters/events are always the relationship source, the location is
 * always the target -- mirrors EventParticipants.tsx's shape for
 * participates_in. */
export function LocationRelations({ locationId }: LocationRelationsProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(locationId);
  const { data: allCharacters = [] } = useCharacters();
  const { data: allEvents = [] } = useEvents();
  const createRelationship = useCreateRelationship();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const locatedAtLinks = relationships.filter((r) => r.relationship_type === LOCATED_AT);
  const linkedSourceIds = new Set(locatedAtLinks.map((r) => r.source_entity_id));

  const characterById = new Map(allCharacters.map((c) => [c.id, c]));
  const eventById = new Map(allEvents.map((e) => [e.id, e]));

  function resolveName(entityId: string): string {
    return characterById.get(entityId)?.name ?? eventById.get(entityId)?.name ?? "Unknown";
  }

  const candidates = [
    ...allCharacters
      .filter((c) => !linkedSourceIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, kind: "Character" })),
    ...allEvents
      .filter((e) => !linkedSourceIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.name, kind: "Event" })),
  ];

  const handleAdd = () => {
    if (!target) return;
    createRelationship.mutate({
      source_entity_id: target,
      target_entity_id: locationId,
      relationship_type: LOCATED_AT,
    });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Link character or event…</option>
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

      {locatedAtLinks.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          No characters or events linked to this location yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {locatedAtLinks.map((rel) => (
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
                aria-label="Remove link"
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
