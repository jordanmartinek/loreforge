import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { useSpeciesList } from "../../hooks/useSpecies";
import { MEMBER_OF, NATIVE_TO } from "../../lib/types";

interface EntitySpeciesLinksProps {
  entityId: string;
  /** "member" for a character's detail view (reads member_of relationships
   * where this entity is the *source*); "habitat" for a location's detail
   * view (reads native_to relationships where this entity is the
   * *target*) -- native_to points species -> location, the mirror-image
   * direction from member_of's character -> species, so the lookup
   * direction differs by integration point (design-phase-6-species.md
   * section 3.3). */
  mode: "member" | "habitat";
}

/** Symmetric counterpart to SpeciesMembers.tsx / SpeciesHabitats.tsx: shown
 * on a Character's or Location's own detail view, listing the species it's
 * linked to. Modeled on Phase 4's EntityLocationLinks.tsx and Phase 5's
 * EntityTechnologyLinks.tsx -- the fourth phase in a row establishing the
 * same "symmetric visibility via useRelationshipsForEntity" pattern. */
export function EntitySpeciesLinks({ entityId, mode }: EntitySpeciesLinksProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allSpecies = [] } = useSpeciesList();

  const speciesById = new Map(allSpecies.map((s) => [s.id, s]));

  const linkedSpecies =
    mode === "member"
      ? relationships
          .filter((r) => r.relationship_type === MEMBER_OF && r.source_entity_id === entityId)
          .map((r) => speciesById.get(r.target_entity_id))
      : relationships
          .filter((r) => r.relationship_type === NATIVE_TO && r.target_entity_id === entityId)
          .map((r) => speciesById.get(r.source_entity_id));

  const resolved = linkedSpecies.filter((s): s is NonNullable<typeof s> => s !== undefined);

  if (resolved.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {mode === "member"
          ? "Not yet linked to a species. Add this from a species' detail view."
          : "Not yet linked as a native habitat for any species. Add this from a species' detail view."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {resolved.map((species) => (
        <li
          key={species.id}
          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
        >
          {species.name}
        </li>
      ))}
    </ul>
  );
}
