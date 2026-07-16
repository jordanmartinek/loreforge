import { useSaveStatusStore } from "../../store/saveStatusStore";

const STATUS_CONFIG = {
  saved: { dot: "bg-[var(--color-success)]", label: "All Changes Saved" },
  saving: { dot: "bg-[var(--color-warning)] animate-pulse", label: "Saving…" },
  offline: { dot: "bg-[var(--color-danger)]", label: "Offline (Queued)" },
} as const;

export function SaveStatusIndicator() {
  const status = useSaveStatusStore((s) => s.status);
  const lastError = useSaveStatusStore((s) => s.lastError);
  const config = STATUS_CONFIG[status];

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
      title={lastError ?? undefined}
    >
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </div>
  );
}
