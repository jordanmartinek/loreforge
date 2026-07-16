use crate::error::{LoreError, Result};
use crate::models::{CanonEntry, CanonFilter, CanonEntryPatch, NewCanonEntry, CANON_STATUSES};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "canon";

fn row_to_canon_entry(row: &Row) -> rusqlite::Result<CanonEntry> {
    Ok(CanonEntry {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        category: row.get("category")?,
        status: row.get("status")?,
        version: row.get("version")?,
        notes: row.get("notes")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    cd.description, cd.category, cd.status, cd.version, cd.notes
";

fn validate_status(status: &str) -> Result<()> {
    if !CANON_STATUSES.contains(&status) {
        return Err(LoreError::InvalidInput(format!(
            "invalid canon status '{status}'; must be one of {CANON_STATUSES:?}"
        )));
    }
    Ok(())
}

pub fn create(conn: &Connection, input: NewCanonEntry) -> Result<CanonEntry> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("canon entry name is required".into()));
    }

    let status = input.status.unwrap_or_else(|| "draft".to_string());
    validate_status(&status)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<CanonEntry> {
        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO canon_details (entity_id, description, category, status, version, notes)
             VALUES (?1, ?2, ?3, ?4, 1, ?5)",
            params![
                id,
                input.description.unwrap_or_default(),
                input.category.unwrap_or_default(),
                status,
                input.notes.unwrap_or_default(),
            ],
        )?;

        let entry = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&entry),
            None,
        )?;
        Ok(entry)
    })();

    match result {
        Ok(entry) => {
            conn.execute("COMMIT", [])?;
            Ok(entry)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

pub fn get(conn: &Connection, id: &str) -> Result<CanonEntry> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN canon_details cd ON cd.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_canon_entry)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("canon entry {id} not found")))
}

pub fn list(conn: &Connection, filter: &CanonFilter) -> Result<Vec<CanonEntry>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN canon_details cd ON cd.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(status) = filter.status.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("cd.status = ?".to_string());
        bind_values.push(status.clone());
    }
    if let Some(category) = filter.category.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("cd.category = ?".to_string());
        bind_values.push(category.clone());
    }

    for cond in &conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }
    sql.push_str(" ORDER BY e.name COLLATE NOCASE ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> =
        bind_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params_refs.as_slice(), row_to_canon_entry)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Updates a canon entry. Any change to a content field (name, description,
/// category, status, or notes) bumps `version` by exactly 1 in the same
/// transaction as the update and the resulting revision-history row (FR1.4,
/// NFR2) -- so the "after" snapshot recorded in `revisions` already
/// reflects the bumped version.
pub fn update(conn: &Connection, id: &str, patch: CanonEntryPatch) -> Result<CanonEntry> {
    if let Some(status) = &patch.status {
        validate_status(status)?;
    }

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<CanonEntry> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        let has_content_change = patch.name.is_some()
            || patch.description.is_some()
            || patch.category.is_some()
            || patch.status.is_some()
            || patch.notes.is_some();

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("canon entry name cannot be empty".into()));
            }
            conn.execute(
                "UPDATE entities SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )?;
        } else {
            conn.execute("UPDATE entities SET updated_at = ?1 WHERE id = ?2", params![now, id])?;
        }

        if let Some(description) = &patch.description {
            conn.execute(
                "UPDATE canon_details SET description = ?1 WHERE entity_id = ?2",
                params![description, id],
            )?;
        }
        if let Some(category) = &patch.category {
            conn.execute(
                "UPDATE canon_details SET category = ?1 WHERE entity_id = ?2",
                params![category, id],
            )?;
        }
        if let Some(status) = &patch.status {
            conn.execute(
                "UPDATE canon_details SET status = ?1 WHERE entity_id = ?2",
                params![status, id],
            )?;
        }
        if let Some(notes) = &patch.notes {
            conn.execute(
                "UPDATE canon_details SET notes = ?1 WHERE entity_id = ?2",
                params![notes, id],
            )?;
        }

        if has_content_change {
            conn.execute(
                "UPDATE canon_details SET version = version + 1 WHERE entity_id = ?1",
                params![id],
            )?;
        }

        let after = get(conn, id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Update,
            id,
            Some(&before),
            Some(&after),
            None,
        )?;
        Ok(after)
    })();

    match result {
        Ok(entry) => {
            conn.execute("COMMIT", [])?;
            Ok(entry)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the canon entry and cascades to any relationships touching
/// it (depends_on / relates_to links), without affecting the entities on
/// the other end of those relationships (FR3.3).
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<()> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE entities SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        conn.execute(
            "UPDATE relationships SET deleted_at = ?1, updated_at = ?1
             WHERE (source_entity_id = ?2 OR target_entity_id = ?2) AND deleted_at IS NULL",
            params![now, id],
        )?;

        revisions::record(
            conn,
            RecordType::Entity,
            Action::Delete,
            id,
            Some(&before),
            None::<&()>,
            None,
        )?;
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", [])?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::models::{NewCharacter, NewRelationship, DEPENDS_ON, RELATES_TO};
    use crate::relationships;
    use crate::revisions as revisions_mod;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewCanonEntry {
                name: "Void Energy".into(),
                description: Some("The fundamental force behind faster-than-light travel.".into()),
                category: Some("Technology".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Void Energy");
        assert_eq!(created.status, "draft"); // defaults to draft (FR2.1)
        assert_eq!(created.version, 1);

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.category, "Technology");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewCanonEntry::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_invalid_status() {
        let conn = setup();
        let err = create(
            &conn,
            NewCanonEntry { name: "Bad Status".into(), status: Some("published".into()), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn status_can_transition_in_any_direction() {
        let conn = setup();
        let created = create(&conn, NewCanonEntry { name: "Swarm Origins".into(), ..Default::default() }).unwrap();
        assert_eq!(created.status, "draft");

        let under_review =
            update(&conn, &created.id, CanonEntryPatch { status: Some("under_review".into()), ..Default::default() }).unwrap();
        assert_eq!(under_review.status, "under_review");

        let approved =
            update(&conn, &created.id, CanonEntryPatch { status: Some("approved".into()), ..Default::default() }).unwrap();
        assert_eq!(approved.status, "approved");

        // No enforced linear workflow -- can go straight back to draft (FR2.2).
        let back_to_draft =
            update(&conn, &created.id, CanonEntryPatch { status: Some("draft".into()), ..Default::default() }).unwrap();
        assert_eq!(back_to_draft.status, "draft");

        let deprecated =
            update(&conn, &created.id, CanonEntryPatch { status: Some("deprecated".into()), ..Default::default() }).unwrap();
        assert_eq!(deprecated.status, "deprecated");
    }

    #[test]
    fn update_rejects_invalid_status() {
        let conn = setup();
        let created = create(&conn, NewCanonEntry { name: "Test".into(), ..Default::default() }).unwrap();
        let err = update(
            &conn,
            &created.id,
            CanonEntryPatch { status: Some("finalized".into()), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn version_increments_by_one_per_content_update_including_status_change() {
        let conn = setup();
        let created = create(&conn, NewCanonEntry { name: "Versioned".into(), ..Default::default() }).unwrap();
        assert_eq!(created.version, 1);

        let after_description =
            update(&conn, &created.id, CanonEntryPatch { description: Some("v2".into()), ..Default::default() }).unwrap();
        assert_eq!(after_description.version, 2);

        // A status transition is a content change, so it also bumps version (FR2.3).
        let after_status =
            update(&conn, &created.id, CanonEntryPatch { status: Some("approved".into()), ..Default::default() }).unwrap();
        assert_eq!(after_status.version, 3);
    }

    #[test]
    fn update_only_touches_provided_fields() {
        let conn = setup();
        let created = create(
            &conn,
            NewCanonEntry {
                name: "Kestrel Doctrine".into(),
                notes: Some("Internal notes v1".into()),
                ..Default::default()
            },
        )
        .unwrap();

        let updated =
            update(&conn, &created.id, CanonEntryPatch { category: Some("Military".into()), ..Default::default() }).unwrap();

        assert_eq!(updated.category, "Military");
        assert_eq!(updated.notes, "Internal notes v1");
        assert_eq!(updated.name, "Kestrel Doctrine");
    }

    #[test]
    fn list_filters_by_status_and_category() {
        let conn = setup();
        create(&conn, NewCanonEntry { name: "A".into(), status: Some("approved".into()), category: Some("Tech".into()), ..Default::default() }).unwrap();
        create(&conn, NewCanonEntry { name: "B".into(), status: Some("draft".into()), category: Some("Tech".into()), ..Default::default() }).unwrap();
        create(&conn, NewCanonEntry { name: "C".into(), status: Some("approved".into()), category: Some("History".into()), ..Default::default() }).unwrap();

        let approved = list(&conn, &CanonFilter { status: Some("approved".into()), ..Default::default() }).unwrap();
        assert_eq!(approved.len(), 2);

        let tech = list(&conn, &CanonFilter { category: Some("Tech".into()), ..Default::default() }).unwrap();
        assert_eq!(tech.len(), 2);

        let approved_tech = list(
            &conn,
            &CanonFilter { status: Some("approved".into()), category: Some("Tech".into()), ..Default::default() },
        )
        .unwrap();
        assert_eq!(approved_tech.len(), 1);
        assert_eq!(approved_tech[0].name, "A");
    }

    #[test]
    fn delete_is_soft_and_hides_from_list() {
        let conn = setup();
        let created = create(&conn, NewCanonEntry { name: "Temp Canon".into(), ..Default::default() }).unwrap();

        delete(&conn, &created.id).unwrap();

        let err = get(&conn, &created.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));

        let all = list(&conn, &CanonFilter::default()).unwrap();
        assert!(all.iter().all(|c| c.id != created.id));
    }

    #[test]
    fn canon_entries_can_depend_on_each_other() {
        let conn = setup();
        let foundation = create(&conn, NewCanonEntry { name: "Void Energy".into(), ..Default::default() }).unwrap();
        let dependent = create(&conn, NewCanonEntry { name: "FTL Drive Doctrine".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: dependent.id.clone(),
                target_entity_id: foundation.id.clone(),
                relationship_type: DEPENDS_ON.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &dependent.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, DEPENDS_ON);
        assert_eq!(links[0].target_entity_id, foundation.id);
    }

    #[test]
    fn canon_entries_can_relate_to_characters_and_events() {
        let conn = setup();
        let canon_entry = create(&conn, NewCanonEntry { name: "The Swarm".into(), ..Default::default() }).unwrap();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: canon_entry.id.clone(),
                target_entity_id: character.id.clone(),
                relationship_type: RELATES_TO.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &canon_entry.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, RELATES_TO);
    }

    #[test]
    fn deleting_canon_entry_cascades_relationships_without_touching_other_side() {
        let conn = setup();
        let canon_entry = create(&conn, NewCanonEntry { name: "Deletable".into(), ..Default::default() }).unwrap();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: canon_entry.id.clone(),
                target_entity_id: character.id.clone(),
                relationship_type: RELATES_TO.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        delete(&conn, &canon_entry.id).unwrap();

        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive canon entry deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewCanonEntry { name: "Revised Canon".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, CanonEntryPatch { description: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions_mod::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete"); // newest first
        assert_eq!(history[2].action, "create");
    }
}
