import { useState } from "react";
import {
  useCreateRequiresEdge,
  useDependents,
  usePrerequisites,
  useTechnologies,
} from "../../hooks/useTechnologies";
import { useDeleteRelationship, useRelationshipsForEntity } from "../../hooks/useRelationships";
import { REQUIRES } from "../../lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface TechnologyDependenciesProps {
  technologyId: string;
}

/** Prerequisites picker/list (FR2.1) plus a read-only dependents list
 * (FR2.3) -- mirrors CanonDependencies.tsx's depends_on picker shape, but
 * adds the dependents-in-the-other-direction display.
 *
 * The picker excludes this technology itself and its *direct* dependents
 * (the one-hop cases a worldbuilder is most likely to hit by accident) as
 * a client-side UX nicety. It does not attempt to exclude indirect/
 * transitive dependents, since that would require fetching the entire
 * technology graph client-side just to filter a dropdown. The backend's
 * `create_requires_edge` (a full graph BFS) remains the authoritative
 * guard for every case, including transitive cycles -- consistent with
 * every other validation in this app being enforced server-side first
 * (design-phase-5-technology.md section 3.2). */
export function TechnologyDependencies({ technologyId }: TechnologyDependenciesProps) {
  const { data: prerequisites = [] } = usePrerequisites(technologyId);
  const { data: dependents = [] } = useDependents(technologyId);
  const { data: allTechnologies = [] } = useTechnologies();
  const { data: relationships = [] } = useRelationshipsForEntity(technologyId);
  const createRequiresEdge = useCreateRequiresEdge();
  const deleteRelationship = useDeleteRelationship();

  const [target, setTarget] = useState("");

  const prerequisiteIds = new Set(prerequisites.map((p) => p.id));
  const directDependentIds = new Set(dependents.map((d) => d.id));
  const candidates = allTechnologies.filter(
    (t) =>
      t.id !== technologyId && !prerequisiteIds.has(t.id) && !directDependentIds.has(t.id),
  );

  const handleAdd = () => {
    if (!target) return;
    createRequiresEdge.mutate({ dependentId: technologyId, prerequisiteId: target });
    setTarget("");
  };

  const prerequisiteRelationships = relationships.filter(
    (r) => r.relationship_type === REQUIRES && r.source_entity_id === technologyId,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Requires (Prerequisites)
        </h4>
        <div className="flex items-center gap-2">
          <Select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1">
            <option value="">Add a prerequisite…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={!target || createRequiresEdge.isPending}
          >
            Link
          </Button>
        </div>
        {createRequiresEdge.isError && (
          <p className="text-xs text-[var(--color-danger)]">
            {createRequiresEdge.error instanceof Error
              ? createRequiresEdge.error.message
              : "Failed to link"}
          </p>
        )}
        {prerequisites.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">No prerequisites yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {prerequisites.map((prereq) => {
              const rel = prerequisiteRelationships.find((r) => r.target_entity_id === prereq.id);
              return (
                <li
                  key={prereq.id}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--color-text-primary)]">{prereq.name}</span>
                  {rel && (
                    <button
                      onClick={() => deleteRelationship.mutate(rel.id)}
                      className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                      aria-label={`Remove prerequisite ${prereq.name}`}
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Required By (Dependents)
        </h4>
        {dependents.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">
            No other technology depends on this one yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {dependents.map((dep) => (
              <li
                key={dep.id}
                className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
              >
                {dep.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
