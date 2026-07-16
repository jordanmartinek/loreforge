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
