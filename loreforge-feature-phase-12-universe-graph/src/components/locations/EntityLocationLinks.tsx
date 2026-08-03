import { useLocations } from "../../hooks/useLocations";
import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { LOCATED_AT } from "../../lib/types";

interface EntityLocationLinksProps {
  entityId: string;
}

/** Symmetric counterpart to LocationRelations.tsx (FR4.4): shown on a
 * Character's or Event's own detail view, listing the location(s) it's
 * linked to via located_at (where this entity is the relationship
 * source). Reuses useRelationshipsForEntity -- no new data-fetching hook
 * needed for this integration point, per design-phase-4-locations.md
 * section 3.3. */
export function EntityLocationLinks({ entityId }: EntityLocationLinksProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allLocations = [] } = useLocations();

  const locationById = new Map(allLocations.map((l) => [l.id, l]));
  const linkedLocations = relationships
    .filter((r) => r.relationship_type === LOCATED_AT && r.source_entity_id === entityId)
    .map((r) => locationById.get(r.target_entity_id))
    .filter((l): l is NonNullable<typeof l> => l !== undefined);

  if (linkedLocations.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Not yet linked to any location. Add this from a location&rsquo;s detail view.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {linkedLocations.map((location) => (
        <li
          key={location.id}
          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
        >
          {location.name}
        </li>
      ))}
    </ul>
  );
}
