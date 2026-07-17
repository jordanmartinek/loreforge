import { MetricCard } from "../components/dashboard/MetricCard";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";

const COMING_SOON_CARDS = [
  { title: "Story Progress", icon: "◔" },
  { title: "Universe", icon: "✦" },
  { title: "Ships", icon: "◆" },
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

        <MetricCard
          title="Canon"
          icon="▣"
          to="/canon"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Approved", value: metrics?.canon_approved ?? 0 },
                  { label: "Draft", value: metrics?.canon_draft ?? 0 },
                  { label: "Under Review", value: metrics?.canon_under_review ?? 0 },
                  { label: "Deprecated", value: metrics?.canon_deprecated ?? 0 },
                ]
          }
        />

        <MetricCard
          title="Locations"
          icon="⌖"
          to="/locations"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Total", value: metrics?.locations_total ?? 0 },
                  { label: "Types Used", value: metrics?.location_types_in_use ?? 0 },
                ]
          }
        />

        <MetricCard
          title="Technology"
          icon="⚙"
          to="/technology"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Total", value: metrics?.technologies_total ?? 0 },
                  { label: "Categories Used", value: metrics?.technology_categories_in_use ?? 0 },
                ]
          }
        />

        <MetricCard
          title="Species"
          icon="❖"
          to="/species"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Total", value: metrics?.species_total ?? 0 },
                  { label: "Classifications Used", value: metrics?.species_classifications_in_use ?? 0 },
                ]
          }
        />

        <MetricCard
          title="Military"
          icon="▲"
          to="/military"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Total", value: metrics?.military_units_total ?? 0 },
                  { label: "Branches Used", value: metrics?.military_branches_in_use ?? 0 },
                ]
          }
        />

        <MetricCard
          title="Politics"
          icon="⚖"
          to="/politics"
          metrics={
            isLoading
              ? undefined
              : [
                  { label: "Total", value: metrics?.political_entities_total ?? 0 },
                  { label: "Classifications Used", value: metrics?.political_classifications_in_use ?? 0 },
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
