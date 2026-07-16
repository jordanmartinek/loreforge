import { useState } from "react";
import { useRevisionsForEntity } from "../../hooks/useRevisions";
import type { RevisionEntry } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { computeDiffSummary } from "./diffSummary";

const ACTION_LABEL: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

const ACTION_TONE: Record<string, string> = {
  create: "text-[var(--color-success)]",
  update: "text-[var(--color-accent-hover)]",
  delete: "text-[var(--color-danger)]",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function RevisionRow({ revision }: { revision: RevisionEntry }) {
  const diff = computeDiffSummary(revision.before_json, revision.after_json);

  return (
    <li className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] px-3 py-2">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${ACTION_TONE[revision.action] ?? ""}`}>
          {ACTION_LABEL[revision.action] ?? revision.action}
        </span>
        <span className="text-[11px] text-[var(--color-text-tertiary)]">
          {formatTimestamp(revision.changed_at)}
        </span>
      </div>
      {diff.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {diff.map((line) => (
            <li key={line.field} className="text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--color-text-primary)]">{line.field}</span>
              {": "}
              <span className="text-[var(--color-text-tertiary)]">{line.before}</span>
              {" → "}
              <span>{line.after}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface RevisionHistoryPanelProps {
  entityId: string;
}

/** Reusable, read-only revision history list (FR4) -- takes only an
 * entityId and works identically for Characters, Events, and Canon
 * Entries, since `revisions.entity_id` is polymorphic across entity types
 * (design-phase-3-canon.md section 1/5). No entity-type-specific code
 * lives here, satisfying FR4.4 ("future entity types get history browsing
 * for free"). */
export function RevisionHistoryPanel({ entityId }: RevisionHistoryPanelProps) {
  const { data: revisions = [], isLoading } = useRevisionsForEntity(entityId);

  if (isLoading) {
    return <p className="text-xs text-[var(--color-text-tertiary)]">Loading history…</p>;
  }

  if (revisions.length === 0) {
    return <p className="text-xs text-[var(--color-text-tertiary)]">No history recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {revisions.map((revision) => (
        <RevisionRow key={revision.id} revision={revision} />
      ))}
    </ul>
  );
}

interface RevisionHistoryButtonProps {
  entityId: string;
  entityName?: string;
}

/** A small "History" affordance (FR4.1) that opens the panel in a modal.
 * Drop this into any detail view alongside an entityId and it just works. */
export function RevisionHistoryButton({ entityId, entityName }: RevisionHistoryButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-2)]"
      >
        History
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={entityName ? `History — ${entityName}` : "History"}
      >
        <RevisionHistoryPanel entityId={entityId} />
      </Modal>
    </>
  );
}
