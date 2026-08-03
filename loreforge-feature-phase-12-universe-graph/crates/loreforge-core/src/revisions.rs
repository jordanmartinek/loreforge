use crate::error::Result;
use crate::models::RevisionEntry;
use rusqlite::{params, Connection, Row};
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

fn row_to_revision(row: &Row) -> rusqlite::Result<RevisionEntry> {
    Ok(RevisionEntry {
        id: row.get("id")?,
        entity_id: row.get("entity_id")?,
        record_type: row.get("record_type")?,
        action: row.get("action")?,
        before_json: row.get("before_json")?,
        after_json: row.get("after_json")?,
        changed_at: row.get("changed_at")?,
        note: row.get("note")?,
    })
}

/// Reads the revision history for a given entity or relationship id,
/// newest-first, capped at `limit` rows. This is the first *read* path over
/// the `revisions` table -- every mutation across Characters (Phase 1),
/// Events (Phase 2), and Canon Entries (Phase 3) has been writing here all
/// along via `record()`, but nothing displayed it until the Version
/// History panel (design-phase-3-canon.md section 1). Bounded by `limit`
/// per NFR3 so entities with very long change logs don't load unbounded
/// history in one query.
pub fn list_for_record(conn: &Connection, entity_id: &str, limit: i64) -> Result<Vec<RevisionEntry>> {
    // `changed_at` comes from SQLite's datetime('now'), which only has
    // second precision -- multiple revisions in the same second (common in
    // tests, and possible in real use during a burst of edits) would tie on
    // that column alone. `rowid` is SQLite's implicit, monotonically
    // increasing insertion-order column (present on every ordinary table,
    // since `revisions.id` being TEXT doesn't turn off rowid the way an
    // INTEGER PRIMARY KEY would), so it's a reliable tiebreaker for
    // "newest first" that a random UUID `id` is not.
    let mut stmt = conn.prepare(
        "SELECT id, entity_id, record_type, action, before_json, after_json, changed_at, note
         FROM revisions WHERE entity_id = ?1 ORDER BY changed_at DESC, rowid DESC LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![entity_id, limit], row_to_revision)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::models::{CharacterPatch, NewCharacter};

    #[test]
    fn list_for_record_returns_newest_first_and_respects_limit() {
        let conn = db::open_in_memory().unwrap();
        let character = characters::create(&conn, NewCharacter { name: "Ada".into(), ..Default::default() }).unwrap();
        for i in 0..5 {
            characters::update(
                &conn,
                &character.id,
                CharacterPatch { biography: Some(format!("v{i}")), ..Default::default() },
            )
            .unwrap();
        }

        // 1 create + 5 updates = 6 total revisions for this entity.
        let all = list_for_record(&conn, &character.id, 100).unwrap();
        assert_eq!(all.len(), 6);
        assert_eq!(all[0].action, "update"); // newest first
        assert_eq!(all.last().unwrap().action, "create"); // oldest last

        let limited = list_for_record(&conn, &character.id, 2).unwrap();
        assert_eq!(limited.len(), 2);
    }
}
