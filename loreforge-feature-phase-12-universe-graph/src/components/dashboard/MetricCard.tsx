import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Metric {
  label: string;
  value: ReactNode;
}

interface MetricCardProps {
  title: string;
  icon: string;
  metrics?: Metric[];
  /** An alternative to `metrics` for cards with no persistent
   * count-of-entities to show (e.g. Notes Import, Phase 11 -- there is no
   * "notes total" metric, since imported text itself is never stored,
   * only the entities it produces, which already show up under their own
   * type's card). When provided (and `metrics` is not), this text renders
   * in place of the metrics grid; every other visual aspect of the card
   * is unchanged. */
  description?: string;
  comingSoon?: boolean;
  to?: string;
}

export function MetricCard({ title, icon, metrics, description, comingSoon, to }: MetricCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => to && navigate(to)}
      disabled={!to}
      className={`flex flex-col gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)]
        p-4 text-left transition-colors
        ${to ? "hover:border-[var(--color-accent)]/50 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
          <span className="text-[var(--color-text-tertiary)]">{icon}</span>
          {title}
        </span>
        {comingSoon && (
          <span className="rounded-full bg-[var(--color-bg-3)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Soon
          </span>
        )}
      </div>

      {metrics && metrics.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-xl font-semibold text-[var(--color-text-primary)]">
                {m.value}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)]">{m.label}</div>
            </div>
          ))}
        </div>
      ) : description ? (
        <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
      ) : (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Module not yet available in this phase.
        </p>
      )}
    </button>
  );
}
