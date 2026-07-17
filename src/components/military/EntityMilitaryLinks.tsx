import { useMilitaryUnits } from "../../hooks/useMilitary";
import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { EQUIPPED_WITH, SERVES_IN, STATIONED_AT } from "../../lib/types";

interface EntityMilitaryLinksProps {
  entityId: string;
  /** "personnel" for a character's detail view (reads serves_in
   * relationships where this entity is the *source*); "stationing" for a
   * location's detail view (reads stationed_at relationships where this
   * entity is the *target*, since stationed_at points military_unit ->
   * location); "equipment" for a technology's detail view (reads
   * equipped_with relationships where this entity is the *target*, same
   * lookup direction as "stationing" -- design-phase-7-military.md
   * section 3.3, extending Phase 6's two-way EntitySpeciesLinks mode prop
   * to a third case). */
  mode: "personnel" | "stationing" | "equipment";
}

/** Symmetric counterpart to UnitPersonnel.tsx / UnitStationing.tsx /
 * UnitEquipment.tsx: shown on a Character's, Location's, or Technology's
 * own detail view, listing the military unit(s) it's linked to. Modeled
 * on Phase 4's EntityLocationLinks.tsx, Phase 5's
 * EntityTechnologyLinks.tsx, and Phase 6's EntitySpeciesLinks.tsx -- the
 * fourth phase in a row establishing the same "symmetric visibility via
 * useRelationshipsForEntity" pattern, this time with three modes instead
 * of two. */
export function EntityMilitaryLinks({ entityId, mode }: EntityMilitaryLinksProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allUnits = [] } = useMilitaryUnits();

  const unitById = new Map(allUnits.map((u) => [u.id, u]));

  const linkedUnits =
    mode === "personnel"
      ? relationships
          .filter((r) => r.relationship_type === SERVES_IN && r.source_entity_id === entityId)
          .map((r) => unitById.get(r.target_entity_id))
      : mode === "stationing"
        ? relationships
            .filter((r) => r.relationship_type === STATIONED_AT && r.target_entity_id === entityId)
            .map((r) => unitById.get(r.source_entity_id))
        : relationships
            .filter((r) => r.relationship_type === EQUIPPED_WITH && r.target_entity_id === entityId)
            .map((r) => unitById.get(r.source_entity_id));

  const resolved = linkedUnits.filter((u): u is NonNullable<typeof u> => u !== undefined);

  if (resolved.length === 0) {
    const emptyMessage: Record<typeof mode, string> = {
      personnel: "Not yet linked to a military unit. Add this from a unit's detail view.",
      stationing: "No units stationed here yet. Add this from a unit's detail view.",
      equipment: "No units are equipped with this yet. Add this from a unit's detail view.",
    };
    return <p className="text-xs text-[var(--color-text-tertiary)]">{emptyMessage[mode]}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {resolved.map((unit) => (
        <li
          key={unit.id}
          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
        >
          {unit.name}
        </li>
      ))}
    </ul>
  );
}
