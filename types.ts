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
  technologies_total: number;
  technology_categories_in_use: number;
  species_total: number;
  species_classifications_in_use: number;
  military_units_total: number;
  military_branches_in_use: number;
  political_entities_total: number;
  political_classifications_in_use: number;
  religions_total: number;
  religion_classifications_in_use: number;
  organizations_total: number;
  organization_classifications_in_use: number;
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

// ---------------------------------------------------------------------
// Phase 5: Technology Bible
// ---------------------------------------------------------------------

// A technology depending on another technology (source requires target).
// Lives in the ordinary relationships table -- unlike Phase 4's location
// hierarchy (a strict tree, a dedicated column), a technology's
// dependencies form an ordinary N:N graph, exactly what relationships
// already models (mirrors loreforge_core::models::REQUIRES).
export const REQUIRES = "requires";

// A character, event, or location using a technology (source = the user,
// target = the technology).
export const USES_TECHNOLOGY = "uses_technology";

export type TechnologyCategory =
  | "ships"
  | "weapons"
  | "power_systems"
  | "communications"
  | "medical"
  | "artificial_intelligence"
  | "void_technology"
  | "military_doctrine"
  | "other";

export const TECHNOLOGY_CATEGORIES: TechnologyCategory[] = [
  "ships",
  "weapons",
  "power_systems",
  "communications",
  "medical",
  "artificial_intelligence",
  "void_technology",
  "military_doctrine",
  "other",
];

export interface Technology {
  id: string;
  name: string;
  category: string;
  description: string;
  introduced_date: string | null;
  date_precision: string;
  created_at: string;
  updated_at: string;
}

export interface NewTechnology {
  name: string;
  category?: string;
  description?: string;
  introduced_date?: string | null;
  date_precision?: string;
}

// introduced_date uses `string | null | undefined` to mirror the Rust
// `Option<Option<String>>` "explicit null" pattern: `undefined` means
// "don't touch the date", `null` means "clear it back to unknown".
export interface TechnologyPatch {
  name?: string;
  category?: string;
  description?: string;
  introduced_date?: string | null;
  date_precision?: string;
}

export interface TechnologyFilter {
  search?: string;
  category?: string;
}

// ---------------------------------------------------------------------
// Phase 6: Species Codex
// ---------------------------------------------------------------------

// A character belonging to a species. Lives in the ordinary relationships
// table -- no new join table (mirrors loreforge_core::models::MEMBER_OF).
export const MEMBER_OF = "member_of";

// A species originating from / commonly found at a location (source =
// species, target = location).
export const NATIVE_TO = "native_to";

export type SpeciesClassification =
  | "sentient_humanoid"
  | "sentient_non_humanoid"
  | "non_sentient_fauna"
  | "non_sentient_flora"
  | "synthetic"
  | "hybrid"
  | "other";

export const SPECIES_CLASSIFICATIONS: SpeciesClassification[] = [
  "sentient_humanoid",
  "sentient_non_humanoid",
  "non_sentient_fauna",
  "non_sentient_flora",
  "synthetic",
  "hybrid",
  "other",
];

export interface Species {
  id: string;
  name: string;
  classification: string;
  biology: string;
  parent_species_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewSpecies {
  name: string;
  classification?: string;
  biology?: string;
  parent_species_id?: string | null;
}

// parent_species_id uses `string | null | undefined` to mirror the Rust
// `Option<Option<String>>` "explicit null" pattern: `undefined` means
// "don't touch the parent", `null` means "move to root" (same convention
// as LocationPatch.parent_location_id / TechnologyPatch.introduced_date).
export interface SpeciesPatch {
  name?: string;
  classification?: string;
  biology?: string;
  parent_species_id?: string | null;
}

export interface SpeciesFilter {
  search?: string;
  classification?: string;
}

// ---------------------------------------------------------------------
// Phase 7: Military
// ---------------------------------------------------------------------

// A character serving in a military unit (source = character, target =
// military unit).
export const SERVES_IN = "serves_in";

// A military unit stationed at a location (source = military unit,
// target = location).
export const STATIONED_AT = "stationed_at";

// A military unit equipped with a technology (source = military unit,
// target = technology).
export const EQUIPPED_WITH = "equipped_with";

export type MilitaryBranch =
  | "army"
  | "navy"
  | "air_force"
  | "space_force"
  | "marines"
  | "special_forces"
  | "militia"
  | "other";

export const MILITARY_BRANCHES: MilitaryBranch[] = [
  "army",
  "navy",
  "air_force",
  "space_force",
  "marines",
  "special_forces",
  "militia",
  "other",
];

export interface MilitaryUnit {
  id: string;
  name: string;
  branch: string;
  doctrine: string;
  parent_unit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewMilitaryUnit {
  name: string;
  branch?: string;
  doctrine?: string;
  parent_unit_id?: string | null;
}

// parent_unit_id uses `string | null | undefined` to mirror the Rust
// `Option<Option<String>>` "explicit null" pattern: `undefined` means
// "don't touch the parent", `null` means "move to the top of the chain of
// command" (same convention as SpeciesPatch.parent_species_id).
export interface MilitaryUnitPatch {
  name?: string;
  branch?: string;
  doctrine?: string;
  parent_unit_id?: string | null;
}

export interface MilitaryUnitFilter {
  search?: string;
  branch?: string;
}

// ---------------------------------------------------------------------
// Phase 8: Politics
// ---------------------------------------------------------------------

// A character leading a political entity (source = character, target =
// political entity).
export const LEADS = "leads";

// A political entity controlling a location as territory (source =
// political entity, target = location).
export const CONTROLS = "controls";

// A symmetric alliance between two political entities. Enforced symmetric
// (no duplicate in either direction, mutually exclusive with RIVAL_OF
// between the same pair) at the application layer, not by the schema.
export const ALLIED_WITH = "allied_with";

// A symmetric rivalry between two political entities. See ALLIED_WITH.
export const RIVAL_OF = "rival_of";

export type PoliticalClassification =
  | "government"
  | "political_party"
  | "faction"
  | "alliance"
  | "guild"
  | "other";

export const POLITICAL_CLASSIFICATIONS: PoliticalClassification[] = [
  "government",
  "political_party",
  "faction",
  "alliance",
  "guild",
  "other",
];

export interface PoliticalEntity {
  id: string;
  name: string;
  classification: string;
  ideology: string;
  founded_date: string | null;
  date_precision: string;
  created_at: string;
  updated_at: string;
}

export interface NewPoliticalEntity {
  name: string;
  classification?: string;
  ideology?: string;
  founded_date?: string | null;
  date_precision?: string;
}

// founded_date uses `string | null | undefined` to mirror the Rust
// `Option<Option<String>>` "explicit null" pattern: `undefined` means
// "don't touch the founding date", `null` means "clear it" (same
// convention as TechnologyPatch.introduced_date).
export interface PoliticalEntityPatch {
  name?: string;
  classification?: string;
  ideology?: string;
  founded_date?: string | null;
  date_precision?: string;
}

export interface PoliticalEntityFilter {
  search?: string;
  classification?: string;
}

// ---------------------------------------------------------------------
// Phase 9: Religions
// ---------------------------------------------------------------------

// A character following a religion (source = character, target =
// religion).
export const FOLLOWS = "follows";

// A religion considering a location a holy site (source = religion,
// target = location).
export const HOLY_SITE = "holy_site";

export type ReligionClassification =
  | "organized_religion"
  | "folk_tradition"
  | "cult"
  | "philosophy"
  | "pantheon_cult"
  | "other";

export const RELIGION_CLASSIFICATIONS: ReligionClassification[] = [
  "organized_religion",
  "folk_tradition",
  "cult",
  "philosophy",
  "pantheon_cult",
  "other",
];

export interface Religion {
  id: string;
  name: string;
  classification: string;
  tenets: string;
  parent_religion_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewReligion {
  name: string;
  classification?: string;
  tenets?: string;
  parent_religion_id?: string | null;
}

// parent_religion_id uses `string | null | undefined` to mirror the Rust
// `Option<Option<String>>` "explicit null" pattern: `undefined` means
// "don't touch the parent", `null` means "move to root" (same convention
// as SpeciesPatch.parent_species_id / MilitaryUnitPatch.parent_unit_id).
export interface ReligionPatch {
  name?: string;
  classification?: string;
  tenets?: string;
  parent_religion_id?: string | null;
}

export interface ReligionFilter {
  search?: string;
  classification?: string;
}

// ---------------------------------------------------------------------
// Phase 10: Organizations
// ---------------------------------------------------------------------

// A character affiliated with an organization (source = character,
// target = organization).
export const AFFILIATED_WITH = "affiliated_with";

// An organization operating out of a location (source = organization,
// target = location).
export const OPERATES_AT = "operates_at";

// A symmetric alliance between two organizations. Distinct from
// Politics' ALLIED_WITH even though the mock-backend validation logic is
// shared -- two organizations being allied and two political entities
// being allied are different facts.
export const ORG_ALLIED_WITH = "org_allied_with";

// A symmetric rivalry between two organizations. See ORG_ALLIED_WITH.
export const ORG_RIVAL_OF = "org_rival_of";

export type OrganizationClassification =
  | "guild"
  | "corporation"
  | "syndicate"
  | "secret_society"
  | "trade_association"
  | "criminal_enterprise"
  | "other";

export const ORGANIZATION_CLASSIFICATIONS: OrganizationClassification[] = [
  "guild",
  "corporation",
  "syndicate",
  "secret_society",
  "trade_association",
  "criminal_enterprise",
  "other",
];

export interface Organization {
  id: string;
  name: string;
  classification: string;
  charter: string;
  parent_organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewOrganization {
  name: string;
  classification?: string;
  charter?: string;
  parent_organization_id?: string | null;
}

// parent_organization_id uses `string | null | undefined` to mirror the
// Rust `Option<Option<String>>` "explicit null" pattern: `undefined`
// means "don't touch the parent", `null` means "move to root".
export interface OrganizationPatch {
  name?: string;
  classification?: string;
  charter?: string;
  parent_organization_id?: string | null;
}

export interface OrganizationFilter {
  search?: string;
  classification?: string;
}

// Mirrors loreforge_core::projects::ProjectInfo. One project = one on-disk
// SQLite database; this is what the startup picker lists/creates/opens.
export interface ProjectInfo {
  id: string;
  name: string;
  created_at: string;
  last_opened_at: string;
}
