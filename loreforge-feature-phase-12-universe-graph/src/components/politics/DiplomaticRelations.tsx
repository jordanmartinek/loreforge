import { useState } from "react";
import { useAllies, usePoliticalEntities, useRivals, useCreateSymmetricEdge } from "../../hooks/usePolitics";
import { useDeleteRelationship, useRelationshipsForEntity } from "../../hooks/useRelationships";
import { ALLIED_WITH, RIVAL_OF } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface DiplomaticRelationsProps {
  entityId: string;
}

/** Renders and manages the symmetric allied_with/rival_of relationships
 * for a political entity (FR3.1-FR3.6). This is new shape, not a copy of
 * a prior phase's linking component: it needs two lists (allies, rivals)
 * fed by two direction-agnostic queries, but a *shared* picker whose
 * relationship type is chosen by which of two buttons the user clicks,
 * since both actions link to the same kind of target (another political
 * entity) and only the semantics differ
 * (design-phase-8-politics.md section 3.1).
 *
 * Rejections (FR3.2 duplicate, FR3.3 mutual exclusivity, FR3.5 self-link)
 * surface as a normal mutation error via useSaveStatusStore -- no new
 * error-display mechanism, consistent with how every prior phase's
 * business-rule rejections (cycles, etc.) have surfaced. */
export function DiplomaticRelations({ entityId }: DiplomaticRelationsProps) {
  const { data: allies = [] } = useAllies(entityId);
  const { data: rivals = [] } = useRivals(entityId);
  const { data: allEntities = [] } = usePoliticalEntities();
  const { data: relationships = [] } = useRelationshipsForEntity(entityId);
  const createSymmetricEdge = useCreateSymmetricEdge();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const allyIds = new Set(allies.map((a) => a.id));
  const rivalIds = new Set(rivals.map((r) => r.id));
  const candidates = allEntities.filter(
    (e) => e.id !== entityId && !allyIds.has(e.id) && !rivalIds.has(e.id),
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
          <option value="">Choose a political entity…</option>
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Button
          variant="primary"
          onClick={() => handleMark(ALLIED_WITH)}
          disabled={!target || createSymmetricEdge.isPending}
        >
          Mark as Ally
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleMark(RIVAL_OF)}
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
                    const id = relationshipIdFor(ally.id, ALLIED_WITH);
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
                    const id = relationshipIdFor(rival.id, RIVAL_OF);
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
