// These types mirror the Rust DTOs in crates/loreforge-core/src/models.rs.
// Kept hand-in-sync for Phase 1; a codegen step can replace this later.

export type CharacterRole = "main" | "supporting" | "minor";
export type CharacterStatus = "alive" | "dead" | "unknown" | "other";

export interface Character {
  id: string;
  name: string;
  role: string;
  status: string;
  biography: string;
  appearance: string;
  goals: string;
  needs: string;
  flaws: string;
  secrets: string;
  psychology: string;
  dialogue_style: string;
  tags: string[];
  needs_development: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewCharacter {
  name: string;
  role?: string;
  status?: string;
  biography?: string;
  appearance?: string;
  goals?: string;
  needs?: string;
  flaws?: string;
  secrets?: string;
  psychology?: string;
  dialogue_style?: string;
  tags?: string[];
}

export interface CharacterPatch {
  name?: string;
  role?: string;
  status?: string;
  biography?: string;
  appearance?: string;
  goals?: string;
  needs?: string;
  flaws?: string;
  secrets?: string;
  psychology?: string;
  dialogue_style?: string;
  tags?: string[];
  needs_development?: boolean;
}

export interface CharacterFilter {
  search?: string;
  role?: string;
  status?: string;
}

export type RelationshipType =
  | "friend"
  | "enemy"
  | "family"
  | "mentor"
  | "student"
  | "political"
  | "professional"
  | "romantic"
  | "unknown"
  | "hidden";

export interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  label: string | null;
  strength: number;
  created_at: string;
  updated_at: string;
}

export interface NewRelationship {
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  label?: string | null;
  strength?: number;
}

export interface RelationshipPatch {
  relationship_type?: string;
  label?: string | null;
  strength?: number;
}

export interface DashboardMetrics {
  characters_total: number;
  characters_main: number;
  characters_supporting: number;
  characters_needs_development: number;
  relationships_total: number;
}

export type SaveStatus = "saved" | "saving" | "offline";
