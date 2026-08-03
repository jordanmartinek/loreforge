import { Link } from "react-router-dom";
import { ENTITY_TYPE_KEYS, ENTITY_TYPE_LABELS, type EntityTypeKey } from "../../lib/notesParser";
import type { ImportResult } from "../../hooks/useNotesImport";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface ImportSummaryProps {
  results: ImportResult[];
  onStartOver: () => void;
}

// Each entity type's own detail page route, so a created entity can be
// linked to directly (FR5.3). Mirrors the routes registered in App.tsx.
const DETAIL_ROUTE_BY_TYPE: Record<EntityTypeKey, string> = {
  character: "/characters",
  location: "/locations",
  technology: "/technology",
  species: "/species",
  military: "/military",
  politics: "/politics",
  religion: "/religions",
  organization: "/organizations",
  canon: "/canon",
  event: "/timeline",
};

/** Post-import results: counts per type, links to each created entity's
 * own list page (FR5.3), and per-candidate failure reporting (FR5.2). An
 * Event candidate's synthesized placeholder date (design doc section
 * 4.3) is called out explicitly here so the user isn't surprised by an
 * unexplained date on the new Event. */
export function ImportSummary({ results, onStartOver }: ImportSummaryProps) {
  const created = results.filter((r) => r.status === "created");
  const failed = results.filter((r) => r.status === "failed");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Import complete: {created.length} created
          {failed.length > 0 && `, ${failed.length} failed`}
        </h2>
        <Button variant="secondary" onClick={onStartOver}>
          Import More Notes
        </Button>
      </div>

      {ENTITY_TYPE_KEYS.map((entityType) => {
        const group = created.filter((r) => r.candidate.entityType === entityType);
        if (group.length === 0) return null;

        return (
          <section key={entityType} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {ENTITY_TYPE_LABELS[entityType]}{" "}
              <span className="text-xs font-normal text-[var(--color-text-tertiary)]">
                ({group.length})
              </span>
            </h3>
            <ul className="flex flex-col gap-1.5">
              {group.map((result) => (
                <li
                  key={result.candidate.id}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {result.candidate.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {entityType === "event" && (
                      <Badge tone="warning">Date not detected — defaulted, please review</Badge>
                    )}
                    <Link
                      to={DETAIL_ROUTE_BY_TYPE[entityType]}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      View →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {failed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-danger)]">
            Could not be created ({failed.length})
          </h3>
          <ul className="flex flex-col gap-1.5">
            {failed.map((result) => (
              <li
                key={result.candidate.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  {result.candidate.name || "(blank name)"}
                </span>
                <span className="text-xs text-[var(--color-danger)]">{result.error}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
