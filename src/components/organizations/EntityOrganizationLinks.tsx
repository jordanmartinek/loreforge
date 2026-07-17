import { useOrganizations } from "../../hooks/useOrganizations";
import { useRelationshipsForEntity } from "../../hooks/useRelationships";
import { AFFILIATED_WITH, OPERATES_AT } from "../../lib/types";

interface EntityOrganizationLinksProps {
  entityId: string;
  /** "affiliation" for a character's detail view (reads affiliated_with
   * relationships where this entity is the *source*); "operatesAt" for a
   * location's detail view (reads operates_at relationships where this
   * entity is the *target*, since operates_at points organization ->
   * location). Two-way, mirroring Phase 6/9's EntitySpeciesLinks.tsx/
   * EntityReligionLinks.tsx shape -- no third mode needed here, since
   * org_allied_with/org_rival_of are already fully rendered on the
   * organization's own detail view by OrgDiplomaticRelations.tsx. */
  mode: "affiliation" | "operatesAt";
}

/** Symmetric counterpart to OrganizationMembers.tsx / OrganizationLocations.tsx:
 * shown on a Character's or Location's own detail view, listing the
 * organization(s) it's linked to. */
export function EntityOrganizationLinks({ entityId, mode }: EntityOrganizationLinksProps) {
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const { data: allOrganizations = [] } = useOrganizations();

  const organizationById = new Map(allOrganizations.map((o) => [o.id, o]));

  const linked =
    mode === "affiliation"
      ? relationships
          .filter((r) => r.relationship_type === AFFILIATED_WITH && r.source_entity_id === entityId)
          .map((r) => organizationById.get(r.target_entity_id))
      : relationships
          .filter((r) => r.relationship_type === OPERATES_AT && r.target_entity_id === entityId)
          .map((r) => organizationById.get(r.source_entity_id));

  const resolved = linked.filter((o): o is NonNullable<typeof o> => o !== undefined);

  if (resolved.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {mode === "affiliation"
          ? "Not affiliated with an organization. Add this from an organization's detail view."
          : "No organizations operate here yet. Add this from an organization's detail view."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {resolved.map((organization) => (
        <li
          key={organization.id}
          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
        >
          {organization.name}
        </li>
      ))}
    </ul>
  );
}
