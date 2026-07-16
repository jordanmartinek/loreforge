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
  events_total: number;
  layers_in_use: number;
  earliest_event_date: string | null;
  latest_event_date: string | null;
  canon_approved: number;
  canon_draft: number;
  canon_under_review: number;
  canon_deprecated: number;
  locations_total: number;
  location_types_in_use: number;
}

export type SaveStatus = "saved" | "saving" | "offline";

// The relationship_type used to link a character to an event they
// participate in. Lives in the ordinary relationships table -- no new join
// table (mirrors loreforge_core::models::PARTICIPATES_IN).
export const PARTICIPATES_IN = "participates_in";

export type EventLayer =
  | "historical"
  | "political"
  | "military"
  | "technology"
  | "character_life"
  | "wars"
  | "books"
  | "screenplays";

export const EVENT_LAYERS: EventLayer[] = [
  "historical",
  "political",
  "military",
  "technology",
  "character_life",
  "wars",
  "books",
  "screenplays",
];

export type DatePrecision = "century" | "decade" | "year" | "month" | "day";
export type EventSignificance = "major" | "minor";

export interface Event {
  id: string;
  name: string;
  description: string;
  layers: string[];
  start_date: string;
  end_date: string | null;
  date_precision: string;
  significance: string;
  created_at: string;
  updated_at: string;
}

export interface NewEvent {
  name: string;
  description?: string;
  layers?: string[];
  start_date: string;
  end_date?: string | null;
  date_precision?: string;
  significance?: string;
}

export interface EventPatch {
  name?: string;
  description?: string;
  layers?: string[];
  start_date?: string;
  end_date?: string | null;
  date_precision?: string;
  significance?: string;
}

export interface EventFilter {
  search?: string;
  layer?: string;
}

// ---------------------------------------------------------------------
// Phase 3: Canon Management
// ---------------------------------------------------------------------

// A canon entry depending on another canon entry (source depends on
// target). Lives in the ordinary relationships table -- no new join table
// (mirrors loreforge_core::models::DEPENDS_ON).
export const DEPENDS_ON = "depends_on";

// A canon entry relating to any other entity (character, event, or another
// canon entry), no fixed directionality requirement.
export const RELATES_TO = "relates_to";

export type CanonStatus = "draft" | "under_review" | "approved" | "deprecated";
export const CANON_STATUSES: CanonStatus[] = [
  "draft",
  "under_review",
  "approved",
  "deprecated",
];

export interface CanonEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  version: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface NewCanonEntry {
  name: string;
  description?: string;
  category?: string;
  status?: string;
  notes?: string;
}

export interface CanonEntryPatch {
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  notes?: string;
}

export interface CanonFilter {
  search?: string;
  status?: string;
  category?: string;
}

// A single row from the revisions table, read-only from the frontend's
// perspective (mirrors loreforge_core::models::RevisionEntry).
export type RevisionAction = "create" | "update" | "delete";

export interface RevisionEntry {
  id: string;
  entity_id: string;
  record_type: string;
  action: string;
  before_json: string | null;
  after_json: string | null;
  changed_at: string;
  note: string | null;
}

// ---------------------------------------------------------------------
// Phase 4: World Explorer (Locations)
// ---------------------------------------------------------------------

// A character or event being associated with a location. Lives in the
// ordinary relationships table -- no new join table (mirrors
// loreforge_core::models::LOCATED_AT).
export const LOCATED_AT = "located_at";

export type LocationType =
  | "galaxy"
  | "solar_system"
  | "planet"
  | "station"
  | "city"
  | "ship"
  | "building"
  | "room"
  | "other";

export const LOCATION_TYPES: LocationType[] = [
  "galaxy",
  "solar_system",
  "planet",
  "station",
  "city",
  "ship",
  "building",
  "room",
  "other",
];

export interface Location {
  id: string;
  name: string;
  location_type: string;
  description: string;
  parent_location_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewLocation {
  name: string;
  location_type?: string;
  description?: string;
  parent_location_id?: string | null;
}

// parent_location_id uses `string | null | undefined` to mirror the Rust
// `Option<Option<String>>` "explicit null" pattern: `undefined` means
// "don't touch the parent", `null` means "move to root".
export interface LocationPatch {
  name?: string;
  location_type?: string;
  description?: string;
  parent_location_id?: string | null;
}

export interface LocationFilter {
  search?: string;
  location_type?: string;
}
