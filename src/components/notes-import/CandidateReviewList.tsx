import { ENTITY_TYPE_KEYS, ENTITY_TYPE_LABELS } from "../../lib/notesParser";
import type { ReviewCandidate } from "../../hooks/useNotesImport";
import { Button } from "../ui/Button";
import { CandidateReviewRow } from "./CandidateReviewRow";

interface CandidateReviewListProps {
  candidates: ReviewCandidate[];
  onChange: (candidates: ReviewCandidate[]) => void;
}

/** Groups candidates by detected entity type (FR4.1), each group with a
 * per-type count and a select-all/none toggle for fast triage of a long
 * list (FR4.5). Groups with zero candidates are omitted entirely. */
export function CandidateReviewList({ candidates, onChange }: CandidateReviewListProps) {
  const updateCandidate = (updated: ReviewCandidate) => {
    onChange(candidates.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <div className="flex flex-col gap-6">
      {ENTITY_TYPE_KEYS.map((entityType) => {
        const group = candidates.filter((c) => c.entityType === entityType);
        if (group.length === 0) return null;

        const allIncluded = group.every((c) => c.included);
        const toggleGroup = (included: boolean) => {
          const groupIds = new Set(group.map((c) => c.id));
          onChange(candidates.map((c) => (groupIds.has(c.id) ? { ...c, included } : c)));
        };

        return (
          <section key={entityType} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {ENTITY_TYPE_LABELS[entityType]}{" "}
                <span className="text-xs font-normal text-[var(--color-text-tertiary)]">
                  ({group.length})
                </span>
              </h3>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => toggleGroup(true)} disabled={allIncluded}>
                  Select all
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => toggleGroup(false)}
                  disabled={group.every((c) => !c.included)}
                >
                  Deselect all
                </Button>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {group.map((candidate) => (
                <CandidateReviewRow key={candidate.id} candidate={candidate} onChange={updateCandidate} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
