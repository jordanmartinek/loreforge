import { useMemo, useState } from "react";
import { useLocation, useUpdateLocation, useCreateLocation, useDeleteLocation, useLocations } from "../../hooks/useLocations";
import type { Location, LocationPatch } from "../../lib/types";
import { LOCATION_TYPES } from "../../lib/types";
import { AutosaveField } from "../characters/AutosaveField";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { EntityMilitaryLinks } from "../military/EntityMilitaryLinks";
import { EntityPoliticsLinks } from "../politics/EntityPoliticsLinks";
import { EntityReligionLinks } from "../religions/EntityReligionLinks";
import { EntitySpeciesLinks } from "../species/EntitySpeciesLinks";
import { EntityTechnologyLinks } from "../technology/EntityTechnologyLinks";
import { LocationBreadcrumb } from "./LocationBreadcrumb";
import { LocationRelations } from "./LocationRelations";

const LOCATION_TYPE_LABELS: Record<string, string> = {
  galaxy: "Galaxy",
  solar_system: "Solar System",
  planet: "Planet",
  station: "Station",
  city: "City",
  ship: "Ship",
  building: "Building",
  room: "Room",
  other: "Other",
};

/** Computes the set of ids that are `rootId` itself or one of its
 * descendants, by walking the flat location list forward from `rootId`.
 * Used to filter the "Move to…" picker so the common cycle case never
 * reaches the backend's authoritative rejection at all (design-phase-4-
 * locations.md section 3.2) -- the backend validation remains the real
 * guard regardless. */
function collectSelfAndDescendants(all: Location[], rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const loc of all) {
      if (loc.parent_location_id && frontier.includes(loc.parent_location_id) && !result.has(loc.id)) {
        result.add(loc.id);
        nextFrontier.push(loc.id);
      }
    }
    frontier = nextFrontier;
  }
  return result;
}

interface LocationDetailProps {
  locationId: string;
  onSelect: (location: Location) => void;
}

export function LocationDetail({ locationId, onSelect }: LocationDetailProps) {
  const { data: location, isLoading } = useLocation(locationId);
  const { data: allLocations = [] } = useLocations();
  const updateLocation = useUpdateLocation();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const [moveTarget, setMoveTarget] = useState("");

  const excludedIds = useMemo(
    () => (location ? collectSelfAndDescendants(allLocations, location.id) : new Set<string>()),
    [allLocations, location],
  );

  if (isLoading || !location) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: LocationPatch) => {
    updateLocation.mutate({ id: location.id, patch });
  };

  const moveCandidates = allLocations.filter((l) => !excludedIds.has(l.id));

  const handleMove = () => {
    if (!moveTarget) return;
    commit({ parent_location_id: moveTarget === "__root__" ? null : moveTarget });
    setMoveTarget("");
  };

  const handleAddChild = async () => {
    const child = await createLocation.mutateAsync({
      name: "New Location",
      parent_location_id: location.id,
    });
    onSelect(child);
  };

  const handleDelete = () => {
    deleteLocation.mutate(location.id);
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div>
        <LocationBreadcrumb location={location} onNavigate={onSelect} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField label="Name" value={location.name} onCommit={(name) => commit({ name })} />
        </div>
        <div className="flex gap-2 pt-5">
          <RevisionHistoryButton entityId={location.id} entityName={location.name} />
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Type
        </label>
        <Select
          value={location.location_type}
          onChange={(e) => commit({ location_type: e.target.value })}
        >
          {LOCATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {LOCATION_TYPE_LABELS[type] ?? type}
            </option>
          ))}
        </Select>
      </div>

      <Section title="Description">
        <AutosaveField
          label="Description"
          value={location.description}
          onCommit={(description) => commit({ description })}
          multiline
        />
      </Section>

      <Section title="Move To">
        <div className="flex items-center gap-2">
          <Select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className="flex-1">
            <option value="">Choose a new parent…</option>
            <option value="__root__">— Root level —</option>
            {moveCandidates.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={handleMove} disabled={!moveTarget}>
            Move
          </Button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          This location&rsquo;s own descendants are hidden from this list to prevent creating a cycle.
        </p>
      </Section>

      <Section title="Child Locations">
        <Button variant="secondary" onClick={handleAddChild} disabled={createLocation.isPending}>
          + Add Child Location
        </Button>
      </Section>

      <Section title="Located Here">
        <LocationRelations locationId={location.id} />
      </Section>

      <Section title="Technology Installed">
        <EntityTechnologyLinks entityId={location.id} />
      </Section>

      <Section title="Native Species">
        <EntitySpeciesLinks entityId={location.id} mode="habitat" />
      </Section>

      <Section title="Military Units Stationed Here">
        <EntityMilitaryLinks entityId={location.id} mode="stationing" />
      </Section>

      <Section title="Controlled By">
        <EntityPoliticsLinks entityId={location.id} mode="territory" />
      </Section>

      <Section title="Holy Site For">
        <EntityReligionLinks entityId={location.id} mode="holySite" />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </div>
  );
}
