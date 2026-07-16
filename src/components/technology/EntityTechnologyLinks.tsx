import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { useTechnologies } from "../../hooks/useTechnologies";
import { USES_TECHNOLOGY } from "../../lib/types";

interface EntityTechnologyLinksProps {
  entityId: string;
}

/** Symmetric counterpart to TechnologyUsage.tsx (FR3.3): shown on a
 * Character's, Event's, or Location's own detail view, listing the
 * technologies it's linked to via uses_technology (where this entity is
 * the relationship source). Modeled directly on Phase 4's
 * EntityLocationLinks.tsx, itself modeled on Phase 2's
 * CharacterTimeline.tsx -- this is the third phase in a row establishing
 * the same "symmetric visibility via useRelationshipsForEntity" pattern
 * for a new relationship type. */
export function EntityTechnologyLinks({ entityId }: EntityTechnologyLinksProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allTechnologies = [] } = useTechnologies();

  const technologyById = new Map(allTechnologies.map((t) => [t.id, t]));
  const linkedTechnologies = relationships
    .filter((r) => r.relationship_type === USES_TECHNOLOGY && r.source_entity_id === entityId)
    .map((r) => technologyById.get(r.target_entity_id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  if (linkedTechnologies.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Not yet linked to any technology. Add this from a technology&rsquo;s detail view.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {linkedTechnologies.map((technology) => (
        <li
          key={technology.id}
          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
        >
          {technology.name}
        </li>
      ))}
    </ul>
  );
}
