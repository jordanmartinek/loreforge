import { ENTITY_TYPE_KEYS, ENTITY_TYPE_LABELS, type EntityTypeKey } from "../../lib/notesParser";
import type { ReviewCandidate } from "../../hooks/useNotesImport";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface CandidateReviewRowProps {
  candidate: ReviewCandidate;
  onChange: (updated: ReviewCandidate) => void;
}

/** One candidate row in the review screen: editable name/type (FR4.2),
 * confidence badge, duplicate-flag badge (FR4.4), source snippet, and an
 * include/exclude toggle. Editing the name or entity type does not
 * re-run the parser -- it directly patches this one candidate's fields,
 * consistent with the requirements doc's explicit scope limit that the
 * review screen only lets the user fix the guessed name/type, not edit
 * full entity fields. */
export function CandidateReviewRow({ candidate, onChange }: CandidateReviewRowProps) {
  return (
    <li
      className={`flex flex-col gap-2 rounded-md border px-3 py-2.5 text-sm
        ${
          candidate.isDuplicate
            ? "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5"
            : "border-[var(--color-border-subtle)] bg-[var(--color-bg-2)]"
        }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={candidate.included}
          onChange={(e) => onChange({ ...candidate, included: e.target.checked })}
          aria-label={`Include ${candidate.name || "candidate"} in import`}
          className="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />

        <Input
          value={candidate.name}
          onChange={(e) => onChange({ ...candidate, name: e.target.value })}
          className="flex-1"
          aria-label="Candidate name"
        />

        <Select
          value={candidate.entityType}
          onChange={(e) => onChange({ ...candidate, entityType: e.target.value as EntityTypeKey })}
          aria-label="Candidate entity type"
        >
          {ENTITY_TYPE_KEYS.map((key) => (
            <option key={key} value={key}>
              {ENTITY_TYPE_LABELS[key]}
            </option>
          ))}
        </Select>

        <Badge tone={candidate.confidence === "structured" ? "accent" : "neutral"}>
          {candidate.confidence === "structured" ? "Structured" : "Keyword match"}
        </Badge>

        {candidate.isDuplicate && <Badge tone="warning">Possible duplicate</Badge>}
      </div>

      <p className="pl-6 text-xs text-[var(--color-text-tertiary)]">“{candidate.snippet}”</p>
    </li>
  );
}
