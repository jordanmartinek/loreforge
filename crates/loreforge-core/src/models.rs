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
}
