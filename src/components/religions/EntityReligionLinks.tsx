import { useReligions } from "../../hooks/useReligions";
import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { FOLLOWS, HOLY_SITE } from "../../lib/types";

interface EntityReligionLinksProps {
  entityId: string;
  /** "follower" for a character's detail view (reads follows
   * relationships where this entity is the *source*); "holySite" for a
   * location's detail view (reads holy_site relationships where this
   * entity is the *target*, since holy_site points religion ->
   * location). Two-way, mirroring Phase 6's EntitySpeciesLinks.tsx shape
   * (design-phase-9-religions.md section 4's "no new UI shape needed"
   * observation). */
  mode: "follower" | "holySite";
}

/** Symmetric counterpart to ReligionFollowers.tsx / ReligionHolySites.tsx:
 * shown on a Character's or Location's own detail view, listing the
 * religion(s) it's linked to. */
export function EntityReligionLinks({ entityId, mode }: EntityReligionLinksProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allReligions = [] } = useReligions();

  const religionById = new Map(allReligions.map((r) => [r.id, r]));

  const linked =
    mode === "follower"
      ? relationships
          .filter((r) => r.relationship_type === FOLLOWS && r.source_entity_id === entityId)
          .map((r) => religionById.get(r.target_entity_id))
      : relationships
          .filter((r) => r.relationship_type === HOLY_SITE && r.target_entity_id === entityId)
          .map((r) => religionById.get(r.source_entity_id));

  const resolved = linked.filter((r): r is NonNullable<typeof r> => r !== undefined);

  if (resolved.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {mode === "follower"
          ? "Doesn't follow a religion. Add this from a religion's detail view."
          : "Not considered a holy site by any religion yet. Add this from a religion's detail view."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {resolved.map((religion) => (
        <li
          key={religion.id}
          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
        >
          {religion.name}
        </li>
      ))}
    </ul>
  );
}
