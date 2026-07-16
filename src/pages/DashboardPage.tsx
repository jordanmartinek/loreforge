import { MetricCard } from "../components/dashboard/MetricCard";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";

const COMING_SOON_CARDS = [
  { title: "Story Progress", icon: "◔" },
  { title: "Universe", icon: "✦" },
  { title: "Canon", icon: "▣" },
  { title: "Locations", icon: "⌖" },
  { title: "Technology", icon: "⚙" },
  { title: "Species", icon: "❖" },
  { title: "Ships", icon: "▲" },
  { title: "Military", icon: "⚔" },
  { title: "Politics", icon: "⚖" },
  { title: "Religions", icon: "☨" },
  { title: "Organizations", icon: "⬡" },
  { title: "Mysteries", icon: "?" },
  { title: "Ideas", icon: "✱" },
  { title: "Drafts", icon: "✎" },
  { title: "Screenplay", icon: "▭" },
  { title: "Analytics", icon: "▤" },
];

function dateSpanLabel(earliest?: string | null, latest?: string | null): string {
  if (!earliest || !latest) return "—";
  const earliestYear = earliest.slice(0, 4);
  const latestYear = latest.slice(0, 4);
  return earliestYear === latestYear ? earliestYear : `${earliestYear}–${latestYear}`;
}

export function DashboardPage() {
  const { data: metrics, isLoading } = useDashboardMetrics();

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Your universe at a glance. Everything below is live data&mdash;create a
        character and watch these numbers change.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          title="Characters"
          icon="◐"
          to="/characters"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Total", value: metrics?.characters_total ?? 0 },
                  { label: "Main", value: metrics?.characters_main ?? 0 },
                  {
                    label: "Supporting",
                    value: metrics?.characters_supporting ?? 0,
                  },
                  {
                    label: "Needs Development",
                    value: metrics?.characters_needs_development ?? 0,
                  },
                ]
          }
        />

        <MetricCard
          title="Universe Graph"
          icon="◎"
          to="/graph"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Nodes", value: metrics?.characters_total ?? 0 },
                  {
                    label: "Relationships",
                    value: metrics?.relationships_total ?? 0,
                  },
                ]
          }
        />

        <MetricCard
          title="Timeline"
          icon="⟿"
          to="/timeline"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Events", value: metrics?.events_total ?? 0 },
                  { label: "Layers", value: metrics?.layers_in_use ?? 0 },
                  {
                    label: "Span",
                    value: dateSpanLabel(
                      metrics?.earliest_event_date,
                      metrics?.latest_event_date,
                    ),
                  },
                ]
          }
        />

        {COMING_SOON_CARDS.map((card) => (
          <MetricCard key={card.title} title={card.title} icon={card.icon} comingSoon />
        ))}
      </div>
    </div>
  );
}
