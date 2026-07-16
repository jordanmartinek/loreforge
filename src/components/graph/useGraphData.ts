import { useMemo } from "react";
import { useCharacters } from "../../hooks/useCharacters";
import { useAllRelationships } from "../../hooks/useRelationships";
import type { Character, Relationship } from "../../lib/types";

export interface GraphNode {
  id: string;
  name: string;
  entityType: "character"; // extensible: more entity types join this union later
  role: string;
  status: string;
  biography: string;
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
  characters: Character[];
  relationships: Relationship[];
  isLoading: boolean;
}

/** Builds the {nodes, links} shape react-force-graph expects from the raw
 * characters/relationships query data (design.md section 5). Filtering by
 * entity type is a no-op today (only "character" exists) but the shape
 * supports it once Location/Technology/etc. entities exist. */
export function useGraphData(entityTypeFilter: Set<string>): GraphData {
  const { data: characters = [], isLoading: loadingCharacters } = useCharacters();
  const { data: relationships = [], isLoading: loadingRelationships } = useAllRelationships();

  const graph = useMemo(() => {
    const degreeById = new Map<string, number>();
    for (const rel of relationships) {
      degreeById.set(rel.source_entity_id, (degreeById.get(rel.source_entity_id) ?? 0) + 1);
      degreeById.set(rel.target_entity_id, (degreeById.get(rel.target_entity_id) ?? 0) + 1);
    }

    const nodes: GraphNode[] = characters
      .filter(() => entityTypeFilter.has("character"))
      .map((c) => ({
        id: c.id,
        name: c.name,
        entityType: "character" as const,
        role: c.role,
        status: c.status,
        biography: c.biography,
        degree: degreeById.get(c.id) ?? 0,
      }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = relationships
      .filter((r) => nodeIds.has(r.source_entity_id) && nodeIds.has(r.target_entity_id))
      .map((r) => ({
        id: r.id,
        source: r.source_entity_id,
        target: r.target_entity_id,
        relationshipType: r.relationship_type,
        strength: r.strength,
      }));

    return { nodes, links };
  }, [characters, relationships, entityTypeFilter]);

  return {
    ...graph,
    characters,
    relationships,
    isLoading: loadingCharacters || loadingRelationships,
  };
}
