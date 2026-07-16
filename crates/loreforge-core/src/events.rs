use crate::error::{LoreError, Result};
use crate::models::{Event, EventFilter, EventPatch, NewEvent};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "event";

fn row_to_event(row: &Row) -> rusqlite::Result<Event> {
    let layers_json: String = row.get("layers_json")?;
    let layers: Vec<String> = serde_json::from_str(&layers_json).unwrap_or_default();

    Ok(Event {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        layers,
        start_date: row.get("start_date")?,
        end_date: row.get("end_date")?,
        date_precision: row.get("date_precision")?,
        significance: row.get("significance")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    ed.description, ed.layers_json, ed.start_date, ed.end_date,
    ed.date_precision, ed.significance
";

/// Validates that, if both dates are present, `end_date` is not before
/// `start_date`. Dates are ISO8601 (YYYY-MM-DD...) strings, which sort
/// lexicographically the same as chronologically, so a plain string
/// comparison is correct and avoids a date-parsing dependency.
fn validate_date_range(start_date: &str, end_date: Option<&str>) -> Result<()> {
    if let Some(end) = end_date {
        if end < start_date {
            return Err(LoreError::InvalidInput(
                "event end_date cannot be before start_date".into(),
            ));
        }
    }
    Ok(())
}

pub fn create(conn: &Connection, input: NewEvent) -> Result<Event> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("event name is required".into()));
    }
    if input.start_date.trim().is_empty() {
        return Err(LoreError::InvalidInput("event start_date is required".into()));
    }
    validate_date_range(&input.start_date, input.end_date.as_deref())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let layers_json = serde_json::to_string(&input.layers.unwrap_or_default())?;
    let date_precision = input.date_precision.unwrap_or_else(|| "day".to_string());
    let significance = input.significance.unwrap_or_else(|| "minor".to_string());

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Event> {
        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO event_details (
                entity_id, description, layers_json, start_date, end_date,
                date_precision, significance
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                input.description.unwrap_or_default(),
                layers_json,
                input.start_date,
                input.end_date,
                date_precision,
                significance,
            ],
        )?;

        let event = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&event),
            None,
        )?;
        Ok(event)
    })();

    match result {
        Ok(event) => {
            conn.execute("COMMIT", [])?;
            Ok(event)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

pub fn get(conn: &Connection, id: &str) -> Result<Event> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN event_details ed ON ed.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_event)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("event {id} not found")))
}

pub fn list(conn: &Connection, filter: &EventFilter) -> Result<Vec<Event>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN event_details ed ON ed.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(layer) = filter.layer.as_ref().filter(|s| !s.trim().is_empty()) {
        // layers_json is a JSON array like ["historical","wars"]; a simple
        // LIKE on the quoted value is sufficient and avoids needing SQLite's
        // JSON1 extension for what is, in practice, a short fixed vocabulary
        // (see models::EVENT_LAYERS).
        conditions.push("ed.layers_json LIKE ?".to_string());
        bind_values.push(format!("%\"{layer}\"%"));
    }

    for cond in &conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }
    sql.push_str(" ORDER BY ed.start_date ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> =
        bind_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params_refs.as_slice(), row_to_event)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: &str, patch: EventPatch) -> Result<Event> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Event> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        // Resolve the effective start/end date (patch value if provided,
        // otherwise the existing value) so we can validate the range even
        // when only one side of the range is being changed in this patch.
        let effective_start = patch.start_date.clone().unwrap_or_else(|| before.start_date.clone());
        let effective_end = match &patch.end_date {
            Some(new_end) => new_end.clone(),
            None => before.end_date.clone(),
        };
        validate_date_range(&effective_start, effective_end.as_deref())?;

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("event name cannot be empty".into()));
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
                "UPDATE event_details SET description = ?1 WHERE entity_id = ?2",
                params![description, id],
            )?;
        }
        if let Some(layers) = &patch.layers {
            let layers_json = serde_json::to_string(layers)?;
            conn.execute(
                "UPDATE event_details SET layers_json = ?1 WHERE entity_id = ?2",
                params![layers_json, id],
            )?;
        }
        if let Some(start_date) = &patch.start_date {
            conn.execute(
                "UPDATE event_details SET start_date = ?1 WHERE entity_id = ?2",
                params![start_date, id],
            )?;
        }
        if let Some(end_date) = &patch.end_date {
            conn.execute(
                "UPDATE event_details SET end_date = ?1 WHERE entity_id = ?2",
                params![end_date, id],
            )?;
        }
        if let Some(date_precision) = &patch.date_precision {
            conn.execute(
                "UPDATE event_details SET date_precision = ?1 WHERE entity_id = ?2",
                params![date_precision, id],
            )?;
        }
        if let Some(significance) = &patch.significance {
            conn.execute(
                "UPDATE event_details SET significance = ?1 WHERE entity_id = ?2",
                params![significance, id],
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
        Ok(event) => {
            conn.execute("COMMIT", [])?;
            Ok(event)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the event and cascades to any relationships touching it
/// (e.g. `participates_in` links to characters). Per FR2.4, deleting an
/// event does NOT touch the characters themselves -- only their link to
/// this event disappears, which falls out naturally since we only clear
/// relationships where the event is source or target.
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
    use crate::characters::{self};
    use crate::db;
    use crate::models::{NewCharacter, NewRelationship, PARTICIPATES_IN};
    use crate::relationships;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewEvent {
                name: "The AI War Begins".into(),
                description: Some("First strike on the Resolute.".into()),
                layers: Some(vec!["military".into(), "wars".into()]),
                start_date: "2140-03-01".into(),
                significance: Some("major".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "The AI War Begins");
        assert_eq!(created.layers, vec!["military", "wars"]);
        assert_eq!(created.significance, "major");

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.description, "First strike on the Resolute.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(
            &conn,
            NewEvent { start_date: "2140-01-01".into(), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_empty_start_date() {
        let conn = setup();
        let err = create(&conn, NewEvent { name: "Nameless gap".into(), ..Default::default() })
            .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_end_before_start() {
        let conn = setup();
        let err = create(
            &conn,
            NewEvent {
                name: "Time paradox".into(),
                start_date: "2140-06-01".into(),
                end_date: Some("2140-01-01".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_rejects_end_before_start_when_only_end_changes() {
        let conn = setup();
        let created = create(
            &conn,
            NewEvent {
                name: "Siege of Kestrel Station".into(),
                start_date: "2141-01-01".into(),
                ..Default::default()
            },
        )
        .unwrap();

        let err = update(
            &conn,
            &created.id,
            EventPatch { end_date: Some(Some("2140-01-01".into())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_only_touches_provided_fields() {
        let conn = setup();
        let created = create(
            &conn,
            NewEvent {
                name: "Founding of the Colony".into(),
                description: Some("Original settlers arrive.".into()),
                start_date: "2100-01-01".into(),
                ..Default::default()
            },
        )
        .unwrap();

        let updated = update(
            &conn,
            &created.id,
            EventPatch { significance: Some("major".into()), ..Default::default() },
        )
        .unwrap();

        assert_eq!(updated.significance, "major");
        assert_eq!(updated.description, "Original settlers arrive.");
        assert_eq!(updated.name, "Founding of the Colony");
    }

    #[test]
    fn list_orders_by_start_date_and_filters_by_layer() {
        let conn = setup();
        create(&conn, NewEvent { name: "Later".into(), start_date: "2150-01-01".into(), layers: Some(vec!["wars".into()]), ..Default::default() }).unwrap();
        create(&conn, NewEvent { name: "Earlier".into(), start_date: "2100-01-01".into(), layers: Some(vec!["historical".into()]), ..Default::default() }).unwrap();
        create(&conn, NewEvent { name: "Middle".into(), start_date: "2125-01-01".into(), layers: Some(vec!["wars".into(), "military".into()]), ..Default::default() }).unwrap();

        let all = list(&conn, &EventFilter::default()).unwrap();
        assert_eq!(all.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), vec!["Earlier", "Middle", "Later"]);

        let wars_only = list(&conn, &EventFilter { layer: Some("wars".into()), ..Default::default() }).unwrap();
        assert_eq!(wars_only.len(), 2);
        assert!(wars_only.iter().all(|e| e.layers.contains(&"wars".to_string())));
    }

    #[test]
    fn delete_is_soft_and_hides_from_list() {
        let conn = setup();
        let created = create(
            &conn,
            NewEvent { name: "Temp Event".into(), start_date: "2100-01-01".into(), ..Default::default() },
        )
        .unwrap();

        delete(&conn, &created.id).unwrap();

        let err = get(&conn, &created.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));

        let all = list(&conn, &EventFilter::default()).unwrap();
        assert!(all.iter().all(|e| e.id != created.id));
    }

    #[test]
    fn character_can_participate_in_event_via_relationships_table() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let event = create(
            &conn,
            NewEvent { name: "The AI War Begins".into(), start_date: "2140-03-01".into(), ..Default::default() },
        )
        .unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: event.id.clone(),
                relationship_type: PARTICIPATES_IN.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &character.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, PARTICIPATES_IN);
        assert_eq!(links[0].target_entity_id, event.id);
    }

    #[test]
    fn deleting_event_cascades_participation_but_deleting_character_does_not_delete_event() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let event = create(
            &conn,
            NewEvent { name: "The AI War Begins".into(), start_date: "2140-03-01".into(), ..Default::default() },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: event.id.clone(),
                relationship_type: PARTICIPATES_IN.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        // Deleting the event should cascade-remove the participation link
        // (FR2.3) but must not touch the character.
        delete(&conn, &event.id).unwrap();
        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok());

        // Re-create the event and link, then delete the character instead:
        // the event must survive, only the relationship goes away (FR2.4).
        let event2 = create(
            &conn,
            NewEvent { name: "Second Event".into(), start_date: "2141-01-01".into(), ..Default::default() },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: event2.id.clone(),
                relationship_type: PARTICIPATES_IN.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        characters::delete(&conn, &character.id).unwrap();
        assert!(get(&conn, &event2.id).is_ok(), "event must survive character deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(
            &conn,
            NewEvent { name: "Revised Event".into(), start_date: "2100-01-01".into(), ..Default::default() },
        )
        .unwrap();
        update(&conn, &created.id, EventPatch { description: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM revisions WHERE entity_id = ?1",
                params![created.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 3);
    }
}
