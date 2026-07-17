use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CharacterRole {
    Main,
    Supporting,
    Minor,
}

impl CharacterRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            CharacterRole::Main => "main",
            CharacterRole::Supporting => "supporting",
            CharacterRole::Minor => "minor",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "main" => CharacterRole::Main,
            "minor" => CharacterRole::Minor,
            _ => CharacterRole::Supporting,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CharacterStatus {
    Alive,
    Dead,
    Unknown,
    Other,
}

impl CharacterStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CharacterStatus::Alive => "alive",
            CharacterStatus::Dead => "dead",
            CharacterStatus::Unknown => "unknown",
            CharacterStatus::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "dead" => CharacterStatus::Dead,
            "unknown" => CharacterStatus::Unknown,
            "other" => CharacterStatus::Other,
            _ => CharacterStatus::Alive,
        }
    }
}

/// Full character DTO returned to the frontend: the generic entity fields
/// flattened together with the character-specific detail fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub biography: String,
    pub appearance: String,
    pub goals: String,
    pub needs: String,
    pub flaws: String,
    pub secrets: String,
    pub psychology: String,
    pub dialogue_style: String,
    pub tags: Vec<String>,
    pub needs_development: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Input payload for creating a character. All narrative fields are optional
/// at creation time -- a character can start as just a name.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewCharacter {
    pub name: String,
    pub role: Option<String>,
    pub status: Option<String>,
    pub biography: Option<String>,
    pub appearance: Option<String>,
    pub goals: Option<String>,
    pub needs: Option<String>,
    pub flaws: Option<String>,
    pub secrets: Option<String>,
    pub psychology: Option<String>,
    pub dialogue_style: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Patch payload for updating a character. Every field is optional; only
/// provided fields are written. `None` means "leave unchanged" -- this
/// supports the autosave-per-field UX where each keystroke only touches one
/// field.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CharacterPatch {
    pub name: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub biography: Option<String>,
    pub appearance: Option<String>,
    pub goals: Option<String>,
    pub needs: Option<String>,
    pub flaws: Option<String>,
    pub secrets: Option<String>,
    pub psychology: Option<String>,
    pub dialogue_style: Option<String>,
    pub tags: Option<Vec<String>>,
    pub needs_development: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CharacterFilter {
    pub search: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub id: String,
    pub source_entity_id: String,
    pub target_entity_id: String,
    pub relationship_type: String,
    pub label: Option<String>,
    pub strength: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewRelationship {
    pub source_entity_id: String,
    pub target_entity_id: String,
    pub relationship_type: String,
    pub label: Option<String>,
    pub strength: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RelationshipPatch {
    pub relationship_type: Option<String>,
    pub label: Option<String>,
    pub strength: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DashboardMetrics {
    pub characters_total: i64,
    pub characters_main: i64,
    pub characters_supporting: i64,
    pub characters_needs_development: i64,
    pub relationships_total: i64,
    pub events_total: i64,
    pub layers_in_use: i64,
    pub earliest_event_date: Option<String>,
    pub latest_event_date: Option<String>,
    pub canon_approved: i64,
    pub canon_draft: i64,
    pub canon_under_review: i64,
    pub canon_deprecated: i64,
    pub locations_total: i64,
    pub location_types_in_use: i64,
    pub technologies_total: i64,
    pub technology_categories_in_use: i64,
    pub species_total: i64,
    pub species_classifications_in_use: i64,
    pub military_units_total: i64,
    pub military_branches_in_use: i64,
    pub political_entities_total: i64,
    pub political_classifications_in_use: i64,
    pub religions_total: i64,
    pub religion_classifications_in_use: i64,
}

/// The relationship_type used to link a character to an event they
/// participate in. Lives in the ordinary `relationships` table (source =
/// character entity id, target = event entity id) -- no new join table, per
/// design-phase-2-timeline.md section 1.
pub const PARTICIPATES_IN: &str = "participates_in";

/// The layers a timeline event can belong to, per the original brief's
/// Timeline System section. An event can belong to more than one.
pub const EVENT_LAYERS: &[&str] = &[
    "historical",
    "political",
    "military",
    "technology",
    "character_life",
    "wars",
    "books",
    "screenplays",
];

/// Full event DTO returned to the frontend: generic entity fields flattened
/// together with event-specific detail fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub name: String,
    pub description: String,
    pub layers: Vec<String>,
    pub start_date: String,
    pub end_date: Option<String>,
    pub date_precision: String,
    pub significance: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewEvent {
    pub name: String,
    pub description: Option<String>,
    pub layers: Option<Vec<String>>,
    pub start_date: String,
    pub end_date: Option<String>,
    pub date_precision: Option<String>,
    pub significance: Option<String>,
}

/// Patch payload for updating an event. `None` means "leave unchanged",
/// mirroring `CharacterPatch`'s per-field autosave contract.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EventPatch {
    pub name: Option<String>,
    pub description: Option<String>,
    pub layers: Option<Vec<String>>,
    pub start_date: Option<String>,
    pub end_date: Option<Option<String>>,
    pub date_precision: Option<String>,
    pub significance: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EventFilter {
    pub search: Option<String>,
    pub layer: Option<String>,
}

// ---------------------------------------------------------------------
// Phase 3: Canon Management
// ---------------------------------------------------------------------

/// A canon entry depending on another canon entry (source depends on
/// target). Lives in the ordinary `relationships` table -- no new join
/// table, per design-phase-3-canon.md section 1.
pub const DEPENDS_ON: &str = "depends_on";

/// A canon entry relating to any other entity (character, event, or another
/// canon entry) with no fixed directionality requirement, unlike
/// PARTICIPATES_IN or DEPENDS_ON.
pub const RELATES_TO: &str = "relates_to";

pub const CANON_STATUSES: &[&str] = &["draft", "under_review", "approved", "deprecated"];

/// Full canon entry DTO returned to the frontend: generic entity fields
/// flattened together with canon-specific detail fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanonEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub status: String,
    pub version: i64,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewCanonEntry {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

/// Patch payload for updating a canon entry. `None` means "leave
/// unchanged", mirroring `CharacterPatch`/`EventPatch`'s per-field autosave
/// contract. Any patch that actually changes a field bumps `version` by 1
/// (see canon::update) -- version is not itself patchable by the client.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanonEntryPatch {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanonFilter {
    pub search: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
}

/// A single row from the `revisions` table, exposed read-only to the
/// frontend for the Version History panel (FR4). `before_json`/`after_json`
/// are passed through as opaque JSON strings; the frontend computes a
/// shallow diff for display rather than the backend pre-computing one, so
/// the shape stays simple regardless of which entity type produced it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevisionEntry {
    pub id: String,
    pub entity_id: String,
    pub record_type: String,
    pub action: String,
    pub before_json: Option<String>,
    pub after_json: Option<String>,
    pub changed_at: String,
    pub note: Option<String>,
}

// ---------------------------------------------------------------------
// Phase 4: World Explorer (Locations)
// ---------------------------------------------------------------------

/// A character or event being associated with a location. Lives in the
/// ordinary `relationships` table (source = character/event entity id,
/// target = location entity id) -- no new join table, per
/// design-phase-4-locations.md section 1.
pub const LOCATED_AT: &str = "located_at";

pub const LOCATION_TYPES: &[&str] = &[
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

/// Full location DTO returned to the frontend: generic entity fields
/// flattened together with location-specific detail fields, including the
/// self-referential `parent_location_id` that makes this entity type
/// hierarchical (unlike every prior phase's flat detail tables).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub id: String,
    pub name: String,
    pub location_type: String,
    pub description: String,
    pub parent_location_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewLocation {
    pub name: String,
    pub location_type: Option<String>,
    pub description: Option<String>,
    pub parent_location_id: Option<String>,
}

/// Patch payload for updating a location. `None` means "leave unchanged",
/// mirroring every prior phase's per-field autosave contract.
/// `parent_location_id` uses the `Option<Option<String>>` "explicit null"
/// pattern (like `EventPatch::end_date`) so a client can distinguish "don't
/// touch the parent" from "move this location to root" (set to `Some(None)`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocationPatch {
    pub name: Option<String>,
    pub location_type: Option<String>,
    pub description: Option<String>,
    pub parent_location_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocationFilter {
    pub search: Option<String>,
    pub location_type: Option<String>,
}

// ---------------------------------------------------------------------
// Phase 5: Technology Bible
// ---------------------------------------------------------------------

/// A technology depending on another technology (source requires target).
/// Lives in the ordinary `relationships` table -- unlike Phase 4's location
/// hierarchy (a strict tree, modeled as a dedicated column), a technology's
/// dependencies form an ordinary N:N graph, exactly what `relationships`
/// already models, per design-phase-5-technology.md section 1.
pub const REQUIRES: &str = "requires";

/// A character, event, or location using a technology (source = the user,
/// target = the technology).
pub const USES_TECHNOLOGY: &str = "uses_technology";

pub const TECHNOLOGY_CATEGORIES: &[&str] = &[
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

/// Full technology DTO returned to the frontend: generic entity fields
/// flattened together with technology-specific detail fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Technology {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub introduced_date: Option<String>,
    pub date_precision: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewTechnology {
    pub name: String,
    pub category: Option<String>,
    pub description: Option<String>,
    pub introduced_date: Option<String>,
    pub date_precision: Option<String>,
}

/// Patch payload for updating a technology. `None` means "leave
/// unchanged", mirroring every prior phase's per-field autosave contract.
/// `introduced_date` uses the `Option<Option<String>>` "explicit null"
/// pattern (like `EventPatch::end_date` / `LocationPatch::parent_location_id`)
/// so a client can distinguish "don't touch the date" from "clear the date
/// back to unknown" (set to `Some(None)`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TechnologyPatch {
    pub name: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub introduced_date: Option<Option<String>>,
    pub date_precision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TechnologyFilter {
    pub search: Option<String>,
    pub category: Option<String>,
}

// ---------------------------------------------------------------------
// Phase 6: Species Codex
// ---------------------------------------------------------------------

/// A character belonging to a species. Lives in the ordinary
/// `relationships` table (source = character entity id, target = species
/// entity id) -- no new join table, per design-phase-6-species.md
/// section 1.
pub const MEMBER_OF: &str = "member_of";

/// A species originating from / commonly found at a location (source =
/// species entity id, target = location entity id).
pub const NATIVE_TO: &str = "native_to";

pub const SPECIES_CLASSIFICATIONS: &[&str] = &[
    "sentient_humanoid",
    "sentient_non_humanoid",
    "non_sentient_fauna",
    "non_sentient_flora",
    "synthetic",
    "hybrid",
    "other",
];

/// Full species DTO returned to the frontend: generic entity fields
/// flattened together with species-specific detail fields, including the
/// self-referential `parent_species_id` that makes taxonomy hierarchical
/// -- the same structural shape as Phase 4's `Location.parent_location_id`,
/// since biological taxonomy is a strict tree, not a graph like Phase 5's
/// technology dependencies (design-phase-6-species.md section 1).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Species {
    pub id: String,
    pub name: String,
    pub classification: String,
    pub biology: String,
    pub parent_species_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewSpecies {
    pub name: String,
    pub classification: Option<String>,
    pub biology: Option<String>,
    pub parent_species_id: Option<String>,
}

/// Patch payload for updating a species. `None` means "leave unchanged",
/// mirroring every prior phase's per-field autosave contract.
/// `parent_species_id` uses the `Option<Option<String>>` "explicit null"
/// pattern (like `LocationPatch::parent_location_id`) so a client can
/// distinguish "don't touch the parent" from "move this species to root"
/// (set to `Some(None)`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SpeciesPatch {
    pub name: Option<String>,
    pub classification: Option<String>,
    pub biology: Option<String>,
    pub parent_species_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SpeciesFilter {
    pub search: Option<String>,
    pub classification: Option<String>,
}

// ---------------------------------------------------------------------
// Phase 7: Military
// ---------------------------------------------------------------------

/// A character serving in a military unit (source = character entity id,
/// target = military unit entity id).
pub const SERVES_IN: &str = "serves_in";

/// A military unit stationed at a location (source = military unit entity
/// id, target = location entity id).
pub const STATIONED_AT: &str = "stationed_at";

/// A military unit equipped with a technology (source = military unit
/// entity id, target = technology entity id).
pub const EQUIPPED_WITH: &str = "equipped_with";

pub const MILITARY_BRANCHES: &[&str] = &[
    "army",
    "navy",
    "air_force",
    "space_force",
    "marines",
    "special_forces",
    "militia",
    "other",
];

// ---------------------------------------------------------------------
// Phase 8: Politics
// ---------------------------------------------------------------------

/// A character leading a political entity (source = character entity id,
/// target = political entity entity id).
pub const LEADS: &str = "leads";

/// A political entity controlling a location as territory (source =
/// political entity entity id, target = location entity id).
pub const CONTROLS: &str = "controls";

/// A symmetric alliance between two political entities. Enforced
/// symmetric (no duplicate in either direction, mutually exclusive with
/// RIVAL_OF between the same pair) at the application layer in
/// `politics.rs`, not by the schema -- see
/// design-phase-8-politics.md section 1.1.
pub const ALLIED_WITH: &str = "allied_with";

/// A symmetric rivalry between two political entities. See ALLIED_WITH.
pub const RIVAL_OF: &str = "rival_of";

pub const POLITICAL_CLASSIFICATIONS: &[&str] = &[
    "government",
    "political_party",
    "faction",
    "alliance",
    "guild",
    "other",
];

// ---------------------------------------------------------------------
// Phase 9: Religions
// ---------------------------------------------------------------------

/// A character following a religion (source = character entity id, target
/// = religion entity id).
pub const FOLLOWS: &str = "follows";

/// A religion considering a location a holy site (source = religion
/// entity id, target = location entity id).
pub const HOLY_SITE: &str = "holy_site";

pub const RELIGION_CLASSIFICATIONS: &[&str] = &[
    "organized_religion",
    "folk_tradition",
    "cult",
    "philosophy",
    "pantheon_cult",
    "other",
];

/// Full religion DTO: generic entity fields flattened together with
/// religion-specific detail fields, including the self-referential
/// `parent_religion_id` that makes the schism/denomination structure
/// hierarchical -- the same structural shape as Phase 4/6/7's
/// `parent_location_id`/`parent_species_id`/`parent_unit_id`
/// (design-phase-9-religions.md section 2).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Religion {
    pub id: String,
    pub name: String,
    pub classification: String,
    pub tenets: String,
    pub parent_religion_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewReligion {
    pub name: String,
    pub classification: Option<String>,
    pub tenets: Option<String>,
    pub parent_religion_id: Option<String>,
}

/// Patch payload for updating a religion. `None` means "leave unchanged".
/// `parent_religion_id` uses the `Option<Option<String>>` "explicit null"
/// pattern (like `SpeciesPatch::parent_species_id`/
/// `MilitaryUnitPatch::parent_unit_id`) so a client can distinguish
/// "don't touch the parent" from "move this religion to the root of its
/// tradition" (set to `Some(None)`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReligionPatch {
    pub name: Option<String>,
    pub classification: Option<String>,
    pub tenets: Option<String>,
    pub parent_religion_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReligionFilter {
    pub search: Option<String>,
    pub classification: Option<String>,
}

/// Full political entity DTO: generic entity fields flattened together
/// with political-entity-specific detail fields. Unlike Phase 4/6/7's
/// hierarchical entity types, there is no self-referential parent column
/// here (design-phase-8-politics.md section 1.2) -- this entity type is
/// flat, closest in shape to Phase 3's `CanonEntry`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoliticalEntity {
    pub id: String,
    pub name: String,
    pub classification: String,
    pub ideology: String,
    pub founded_date: Option<String>,
    pub date_precision: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewPoliticalEntity {
    pub name: String,
    pub classification: Option<String>,
    pub ideology: Option<String>,
    pub founded_date: Option<String>,
    pub date_precision: Option<String>,
}

/// Patch payload for updating a political entity. `None` means "leave
/// unchanged", mirroring every prior phase's per-field autosave contract.
/// `founded_date` uses the `Option<Option<String>>` "explicit null"
/// pattern (like `TechnologyPatch::introduced_date`) so a client can
/// distinguish "don't touch the founding date" from "clear it" (set to
/// `Some(None)`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PoliticalEntityPatch {
    pub name: Option<String>,
    pub classification: Option<String>,
    pub ideology: Option<String>,
    pub founded_date: Option<Option<String>>,
    pub date_precision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PoliticalEntityFilter {
    pub search: Option<String>,
    pub classification: Option<String>,
}

/// Full military unit DTO: generic entity fields flattened together with
/// unit-specific detail fields, including the self-referential
/// `parent_unit_id` that makes chain of command hierarchical -- the same
/// structural shape as Phase 4's `Location.parent_location_id` and Phase
/// 6's `Species.parent_species_id`, since a chain of command is a strict
/// tree, not a graph like Phase 5's technology dependencies
/// (design-phase-7-military.md section 1).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MilitaryUnit {
    pub id: String,
    pub name: String,
    pub branch: String,
    pub doctrine: String,
    pub parent_unit_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NewMilitaryUnit {
    pub name: String,
    pub branch: Option<String>,
    pub doctrine: Option<String>,
    pub parent_unit_id: Option<String>,
}

/// Patch payload for updating a military unit. `None` means "leave
/// unchanged", mirroring every prior phase's per-field autosave contract.
/// `parent_unit_id` uses the `Option<Option<String>>` "explicit null"
/// pattern (like `SpeciesPatch::parent_species_id`) so a client can
/// distinguish "don't touch the parent" from "move this unit to the top
/// of the chain of command" (set to `Some(None)`).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MilitaryUnitPatch {
    pub name: Option<String>,
    pub branch: Option<String>,
    pub doctrine: Option<String>,
    pub parent_unit_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MilitaryUnitFilter {
    pub search: Option<String>,
    pub branch: Option<String>,
}
