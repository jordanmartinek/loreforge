import { useMemo } from "react";
import { useCanonEntries } from "../../hooks/useCanon";
import { useCharacters } from "../../hooks/useCharacters";
import { useEvents } from "../../hooks/useEvents";
import { useLocations } from "../../hooks/useLocations";
import { useMilitaryUnits } from "../../hooks/useMilitary";
import { useOrganizations } from "../../hooks/useOrganizations";
import { usePoliticalEntities } from "../../hooks/usePolitics";
import { useAllRelationships } from "../../hooks/useRelationships";
import { useReligions } from "../../hooks/useReligions";
import { useSpeciesList } from "../../hooks/useSpecies";
import { useTechnologies } from "../../hooks/useTechnologies";
import { ENTITY_TYPE_KEYS, type EntityTypeKey } from "../../lib/entityTypes";
import type { Relationship } from "../../lib/types";

export interface GraphNode {
  id: string;
  name: string;
  entityType: EntityTypeKey;
  /** A short, type-appropriate subtitle shown in the hover tooltip (e.g. a
   * character's role, a location's location_type, a species'
   * classification) -- each entity type has a differently-named "kind"
   * field in lib/types.ts, so this is computed once per node here rather
   * than making every consumer re-derive it per type (Phase 12 design
   * doc section 2.1). */
  subtitle: string;
  degree: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  relationshipType: string;
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  isLoading: boolean;
  /** True if the universe has zero entities of *any* type, regardless of
   * `entityTypeFilter`. Distinguished from `nodes.length === 0` (which can
   * also mean "the current filter selection excludes every entity that
   * does exist") so the UI can tell "there's genuinely nothing yet" apart
   * from "your filters are just hiding everything" (Phase 12 FR2.4) --
   * without this, toggling off the only entity type with data would make
   * the graph (including the filter bar itself) disappear entirely,
   * leaving no way to toggle it back on. */
  hasAnyEntities: boolean;
}

/** Builds the {nodes, links} shape react-force-graph expects, now sourced
 * from all 10 entity types (Phase 12 FR1.1), not just characters (Phase
 * 1's original scope). Every entity type already exposes a flat `use*`
 * list-query hook (Characters/Locations/Technologies/.../Events) that
 * other pages already call, so this reuses those directly rather than
 * introducing a new combined query -- same reasoning as
 * useNotesImport.ts's useExistingNamesByType, one phase earlier. Filtering
 * by entity type (`entityTypeFilter`) is applied client-side over the
 * already-loaded data (design doc section 2.2). */
export function useGraphData(entityTypeFilter: Set<EntityTypeKey>): GraphData {
  const { data: characters = [], isLoading: l1 } = useCharacters();
  const { data: locations = [], isLoading: l2 } = useLocations();
  const { data: technologies = [], isLoading: l3 } = useTechnologies();
  const { data: species = [], isLoading: l4 } = useSpeciesList();
  const { data: militaryUnits = [], isLoading: l5 } = useMilitaryUnits();
  const { data: politicalEntities = [], isLoading: l6 } = usePoliticalEntities();
  const { data: religions = [], isLoading: l7 } = useReligions();
  const { data: organizations = [], isLoading: l8 } = useOrganizations();
  const { data: canonEntries = [], isLoading: l9 } = useCanonEntries();
  const { data: events = [], isLoading: l10 } = useEvents();
  const { data: relationships = [], isLoading: l11 } = useAllRelationships();

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9 || l10 || l11;

  const allNodesByType = useMemo((): Record<EntityTypeKey, GraphNode[]> => {
    // Each mapper below picks that entity type's own "kind" field for the
    // subtitle (role for Character, location_type for Location, etc.) --
    // see the GraphNode.subtitle doc comment. Degree is filled in below,
    // once every node from every type is known, since a relationship can
    // (from Phase 8/10 onward) connect two entities of *different* types
    // (e.g. Politics' `controls` links a political entity to a location),
    // so degree can't be computed type-by-type in isolation.
    return {
      character: characters.map((c) => ({
        id: c.id,
        name: c.name,
        entityType: "character" as const,
        subtitle: c.role,
        degree: 0,
      })),
      location: locations.map((l) => ({
        id: l.id,
        name: l.name,
        entityType: "location" as const,
        subtitle: l.location_type,
        degree: 0,
      })),
      technology: technologies.map((t) => ({
        id: t.id,
        name: t.name,
        entityType: "technology" as const,
        subtitle: t.category,
        degree: 0,
      })),
      species: species.map((s) => ({
        id: s.id,
        name: s.name,
        entityType: "species" as const,
        subtitle: s.classification,
        degree: 0,
      })),
      military: militaryUnits.map((m) => ({
        id: m.id,
        name: m.name,
        entityType: "military" as const,
        subtitle: m.branch,
        degree: 0,
      })),
      politics: politicalEntities.map((p) => ({
        id: p.id,
        name: p.name,
        entityType: "politics" as const,
        subtitle: p.classification,
        degree: 0,
      })),
      religion: religions.map((r) => ({
        id: r.id,
        name: r.name,
        entityType: "religion" as const,
        subtitle: r.classification,
        degree: 0,
      })),
      organization: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        entityType: "organization" as const,
        subtitle: o.classification,
        degree: 0,
      })),
      canon: canonEntries.map((c) => ({
        id: c.id,
        name: c.name,
        entityType: "canon" as const,
        subtitle: c.status,
        degree: 0,
      })),
      event: events.map((e) => ({
        id: e.id,
        name: e.name,
        entityType: "event" as const,
        subtitle: e.significance,
        degree: 0,
      })),
    };
  }, [
    characters,
    locations,
    technologies,
    species,
    militaryUnits,
    politicalEntities,
    religions,
    organizations,
    canonEntries,
    events,
  ]);

  const graph = useMemo(() => {
    const activeNodes: GraphNode[] = ENTITY_TYPE_KEYS.filter((type) =>
      entityTypeFilter.has(type),
    ).flatMap((type) => allNodesByType[type]);

    const degreeById = new Map<string, number>();
    for (const rel of relationships) {
      degreeById.set(rel.source_entity_id, (degreeById.get(rel.source_entity_id) ?? 0) + 1);
      degreeById.set(rel.target_entity_id, (degreeById.get(rel.target_entity_id) ?? 0) + 1);
    }

    const nodes: GraphNode[] = activeNodes.map((node) => ({
      ...node,
      degree: degreeById.get(node.id) ?? 0,
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = (relationships as Relationship[])
      .filter((r) => nodeIds.has(r.source_entity_id) && nodeIds.has(r.target_entity_id))
      .map((r) => ({
        id: r.id,
        source: r.source_entity_id,
        target: r.target_entity_id,
        relationshipType: r.relationship_type,
        strength: r.strength,
      }));

    return { nodes, links };
  }, [allNodesByType, relationships, entityTypeFilter]);

  const hasAnyEntities = useMemo(
    () => ENTITY_TYPE_KEYS.some((type) => allNodesByType[type].length > 0),
    [allNodesByType],
  );

  return {
    ...graph,
    isLoading,
    hasAnyEntities,
  };
}
