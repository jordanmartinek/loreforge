import { useEvents } from "../../hooks/useEvents";
import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { PARTICIPATES_IN } from "../../lib/types";

interface CharacterTimelineProps {
  characterId: string;
}

/** A character's chronological list of participated events (FR2.2). Reuses
 * useRelationshipsForEntity (Phase 1) + useEvents (Phase 2) directly -- no
 * new data-fetching hook needed for this integration point, per
 * design-phase-2-timeline.md section 3.3. */
export function CharacterTimeline({ characterId }: CharacterTimelineProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(characterId);
  const { data: allEvents = [] } = useEvents();

  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const participatedEvents = relationships
    .filter((r) => r.relationship_type === PARTICIPATES_IN && r.source_entity_id === characterId)
    .map((r) => eventById.get(r.target_entity_id))
    .filter((e): e is NonNullable<typeof e> => e !== undefined)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (participatedEvents.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        This character hasn&rsquo;t been linked to any timeline events yet. Add them from an
        event&rsquo;s Participants panel.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {participatedEvents.map((event) => (
        <li
          key={event.id}
          className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
        >
          <span className="font-medium text-[var(--color-text-primary)]">{event.name}</span>
          <span className="text-xs text-[var(--color-text-tertiary)]">{event.start_date}</span>
        </li>
      ))}
    </ul>
  );
}
