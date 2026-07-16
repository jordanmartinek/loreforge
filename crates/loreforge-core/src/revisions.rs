use crate::error::Result;
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

/// Record type discriminator for the polymorphic `revisions.entity_id` column.
pub enum RecordType {
    Entity,
    Relationship,
}

impl RecordType {
    fn as_str(&self) -> &'static str {
        match self {
            RecordType::Entity => "entity",
            RecordType::Relationship => "relationship",
        }
    }
}

pub enum Action {
    Create,
    Update,
    Delete,
}

impl Action {
    fn as_str(&self) -> &'static str {
        match self {
            Action::Create => "create",
            Action::Update => "update",
            Action::Delete => "delete",
        }
    }
}

/// Writes a revision row. Callers are expected to invoke this inside the same
/// transaction as the mutation it documents, so a crash can never leave a
/// mutation without its matching history entry (or vice versa).
pub fn record<B: Serialize, A: Serialize>(
    conn: &Connection,
    record_type: RecordType,
    action: Action,
    record_id: &str,
    before: Option<&B>,
    after: Option<&A>,
    note: Option<&str>,
) -> Result<()> {
    let before_json: Option<Value> = before.map(serde_json::to_value).transpose()?;
    let after_json: Option<Value> = after.map(serde_json::to_value).transpose()?;

    conn.execute(
        "INSERT INTO revisions (id, entity_id, record_type, action, before_json, after_json, changed_at, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), ?7)",
        params![
            Uuid::new_v4().to_string(),
            record_id,
            record_type.as_str(),
            action.as_str(),
            before_json.map(|v| v.to_string()),
            after_json.map(|v| v.to_string()),
            note,
        ],
    )?;
    Ok(())
}
