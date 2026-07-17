import { useState } from "react";
import {
  useCreateOrgSymmetricEdge,
  useOrganizations,
  useOrgAllies,
  useOrgRivals,
} from "../../hooks/useOrganizations";
import { useDeleteRelationship, useRelationshipsForEntity } from "../../hooks/useRelationships";
import { ORG_ALLIED_WITH, ORG_RIVAL_OF } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface OrgDiplomaticRelationsProps {
  entityId: string;
}

/** Renders and manages the symmetric org_allied_with/org_rival_of
 * relationships for an organization (FR5.1-FR5.5). Generalized from
 * Phase 8's `DiplomaticRelations.tsx` rather than duplicated wholesale:
 * this component's logic (pick a target, choose ally or rival, show two
 * lists) has no organization-specific variation to discover -- only the
 * data source (`useOrganizations`/`useOrgAllies`/`useOrgRivals`/
 * `useCreateOrgSymmetricEdge` instead of Politics' equivalents) and the
 * two relationship-type constants differ, which is exactly the same
 * shape of change the Rust-side `symmetric.rs` extraction made
 * (design-phase-10-organizations.md section 4.2). Kept as a sibling
 * component rather than a further-generalized shared one, since the two
 * components' hook imports are still concretely typed per entity type
 * (`Organization` vs. `PoliticalEntity`) -- a third consumer would be the
 * point to consider a fully generic version, per this codebase's running
 * "wait for enough real examples" principle. */
export function OrgDiplomaticRelations({ entityId }: OrgDiplomaticRelationsProps) {
  const { data: allies = [] } = useOrgAllies(entityId);
  const { data: rivals = [] } = useOrgRivals(entityId);
  const { data: allOrganizations = [] } = useOrganizations();
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const createSymmetricEdge = useCreateOrgSymmetricEdge();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const allyIds = new Set(allies.map((a) => a.id));
  const rivalIds = new Set(rivals.map((r) => r.id));
  const candidates = allOrganizations.filter(
    (o) => o.id !== entityId && !allyIds.has(o.id) && !rivalIds.has(o.id),
  );

  const relationshipIdFor = (otherId: string, type: string) =>
    relationships.find(
      (r) =>
        r.relationship_type === type &&
        ((r.source_entity_id === entityId && r.target_entity_id === otherId) ||
          (r.source_entity_id === otherId && r.target_entity_id === entityId)),
    )?.id;

  const handleMark = (relationshipType: string) => {
    if (!target) return;
    createSymmetricEdge.mutate(
      { a: entityId, b: target, relationshipType },
      { onSuccess: () => setTarget("") },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
          <option value="">Choose an organization…</option>
          {candidates.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Button
          variant="primary"
          onClick={() => handleMark(ORG_ALLIED_WITH)}
          disabled={!target || createSymmetricEdge.isPending}
        >
          Mark as Ally
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleMark(ORG_RIVAL_OF)}
          disabled={!target || createSymmetricEdge.isPending}
        >
          Mark as Rival
        </Button>
      </div>

      {createSymmetricEdge.isError && (
        <p className="text-xs text-[var(--color-danger)]">
          {createSymmetricEdge.error instanceof Error
            ? createSymmetricEdge.error.message
            : "Could not create this diplomatic link."}
        </p>
      )}

      <div>
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Allies
        </h4>
        {allies.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">No allies recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {allies.map((ally) => (
              <li
                key={ally.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--color-text-primary)]">{ally.name}</span>
                <button
                  onClick={() => {
                    const id = relationshipIdFor(ally.id, ORG_ALLIED_WITH);
                    if (id) deleteRelationship.mutate(id);
                  }}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                  aria-label={`Remove alliance with ${ally.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Rivals
        </h4>
        {rivals.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">No rivals recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rivals.map((rival) => (
              <li
                key={rival.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--color-text-primary)]">{rival.name}</span>
                <button
                  onClick={() => {
                    const id = relationshipIdFor(rival.id, ORG_RIVAL_OF);
                    if (id) deleteRelationship.mutate(id);
                  }}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                  aria-label={`Remove rivalry with ${rival.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
