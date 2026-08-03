import { usePoliticalEntities } from "../../hooks/usePolitics";
import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { CONTROLS, LEADS } from "../../lib/types";

interface EntityPoliticsLinksProps {
  entityId: string;
  /** "leadership" for a character's detail view (reads leads
   * relationships where this entity is the *source*); "territory" for a
   * location's detail view (reads controls relationships where this
   * entity is the *target*, since controls points political_entity ->
   * location). Two-way, mirroring Phase 6's EntitySpeciesLinks.tsx shape
   * rather than Phase 7's three-way one, since allied_with/rival_of are
   * already fully rendered on the political entity's own detail view by
   * DiplomaticRelations.tsx -- there's no third mode needed here
   * (design-phase-8-politics.md section 3.2). */
  mode: "leadership" | "territory";
}

/** Symmetric counterpart to PoliticalLeadership.tsx / PoliticalTerritory.tsx:
 * shown on a Character's or Location's own detail view, listing the
 * political entity/entities it's linked to. */
export function EntityPoliticsLinks({ entityId, mode }: EntityPoliticsLinksProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allEntities = [] } = usePoliticalEntities();

  const entityById = new Map(allEntities.map((e) => [e.id, e]));

  const linked =
    mode === "leadership"
      ? relationships
          .filter((r) => r.relationship_type === LEADS && r.source_entity_id === entityId)
          .map((r) => entityById.get(r.target_entity_id))
      : relationships
          .filter((r) => r.relationship_type === CONTROLS && r.target_entity_id === entityId)
          .map((r) => entityById.get(r.source_entity_id));

  const resolved = linked.filter((e): e is NonNullable<typeof e> => e !== undefined);

  if (resolved.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {mode === "leadership"
          ? "Doesn't lead a political entity. Add this from a political entity's detail view."
          : "Not controlled by any political entity yet. Add this from a political entity's detail view."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {resolved.map((entity) => (
        <li
          key={entity.id}
          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
        >
          {entity.name}
        </li>
      ))}
    </ul>
  );
}
