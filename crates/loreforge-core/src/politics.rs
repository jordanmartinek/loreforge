use crate::error::{LoreError, Result};
use crate::models::{
    NewPoliticalEntity, NewRelationship, PoliticalEntity, PoliticalEntityFilter,
    PoliticalEntityPatch, Relationship, ALLIED_WITH, RIVAL_OF,
};
use crate::relationships;
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "political_entity";

fn row_to_political_entity(row: &Row) -> rusqlite::Result<PoliticalEntity> {
    Ok(PoliticalEntity {
        id: row.get("id")?,
        name: row.get("name")?,
        classification: row.get("classification")?,
        ideology: row.get("ideology")?,
        founded_date: row.get("founded_date")?,
        date_precision: row.get("date_precision")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    ped.classification, ped.ideology, ped.founded_date, ped.date_precision
";

pub fn get(conn: &Connection, id: &str) -> Result<PoliticalEntity> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN political_entity_details ped ON ped.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_political_entity)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("political entity {id} not found")))
}

pub fn list(conn: &Connection, filter: &PoliticalEntityFilter) -> Result<Vec<PoliticalEntity>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN political_entity_details ped ON ped.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(classification) = filter.classification.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("ped.classification = ?".to_string());
        bind_values.push(classification.clone());
    }

    for cond in &conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }
    sql.push_str(" ORDER BY e.name COLLATE NOCASE ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> =
        bind_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params_refs.as_slice(), row_to_political_entity)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn create(conn: &Connection, input: NewPoliticalEntity) -> Result<PoliticalEntity> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("political entity name is required".into()));
    }

    let classification = input.classification.unwrap_or_else(|| "other".to_string());
    let date_precision = input.date_precision.unwrap_or_else(|| "day".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<PoliticalEntity> {
        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO political_entity_details (entity_id, classification, ideology, founded_date, date_precision)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id,
                classification,
                input.ideology.unwrap_or_default(),
                input.founded_date,
                date_precision,
            ],
        )?;

        let entity = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&entity),
            None,
        )?;
        Ok(entity)
    })();

    match result {
        Ok(entity) => {
            conn.execute("COMMIT", [])?;
            Ok(entity)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

pub fn update(conn: &Connection, id: &str, patch: PoliticalEntityPatch) -> Result<PoliticalEntity> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<PoliticalEntity> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("political entity name cannot be empty".into()));
            }
            conn.execute(
                "UPDATE entities SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )?;
        } else {
            conn.execute("UPDATE entities SET updated_at = ?1 WHERE id = ?2", params![now, id])?;
        }

        if let Some(classification) = &patch.classification {
            conn.execute(
                "UPDATE political_entity_details SET classification = ?1 WHERE entity_id = ?2",
                params![classification, id],
            )?;
        }
        if let Some(ideology) = &patch.ideology {
            conn.execute(
                "UPDATE political_entity_details SET ideology = ?1 WHERE entity_id = ?2",
                params![ideology, id],
            )?;
        }
        if let Some(founded_date) = &patch.founded_date {
            conn.execute(
                "UPDATE political_entity_details SET founded_date = ?1 WHERE entity_id = ?2",
                params![founded_date, id],
            )?;
        }
        if let Some(date_precision) = &patch.date_precision {
            conn.execute(
                "UPDATE political_entity_details SET date_precision = ?1 WHERE entity_id = ?2",
                params![date_precision, id],
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
        Ok(entity) => {
            conn.execute("COMMIT", [])?;
            Ok(entity)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the political entity and cascades any relationships
/// touching it (`leads`, `controls`, `allied_with`, `rival_of` -- as
/// either source or target), without affecting the characters/locations/
/// other political entities on the other end (FR4.1).
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

/// Finds an existing edge of `relationship_type` between `a` and `b`, in
/// either direction. Returns the relationship id if found. This is the
/// direction-agnostic lookup that makes ALLIED_WITH/RIVAL_OF symmetric
/// despite the underlying table always storing a source/target pair
/// (design-phase-8-politics.md section 1.1, point 1).
fn find_edge_either_direction(
    conn: &Connection,
    a: &str,
    b: &str,
    relationship_type: &str,
) -> Result<Option<String>> {
    conn.query_row(
        "SELECT id FROM relationships
         WHERE relationship_type = ?1 AND deleted_at IS NULL
         AND ((source_entity_id = ?2 AND target_entity_id = ?3)
              OR (source_entity_id = ?3 AND target_entity_id = ?2))",
        params![relationship_type, a, b],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(LoreError::from)
}

/// Creates a symmetric edge (`ALLIED_WITH` or `RIVAL_OF`) between two
/// political entities `a` and `b`. Validates, in order, before any write
/// happens:
///   1. No self-link (delegated to `relationships::create`'s existing
///      guard, but checked here too so the cycle/duplicate checks below
///      don't need to special-case it).
///   2. No existing edge of the *same* type already exists between this
///      pair, in either direction (FR3.2).
///   3. No existing edge of the *opposite* symmetric type exists between
///      this pair, in either direction (FR3.3) -- a pair cannot be both
///      allied and rivals at once.
/// This is the one place the frontend needs to know "these two
/// relationship types have extra rules"; every other relationship type
/// in the app is created directly through the generic
/// `relationships::create`, which stays unaware of politics-specific
/// rules (design-phase-8-politics.md section 1.1, mirroring Phase 5's
/// `create_requires_edge`/Phase 6+7's cycle-check wrappers).
pub fn create_symmetric_edge(
    conn: &Connection,
    a: &str,
    b: &str,
    relationship_type: &str,
) -> Result<Relationship> {
    if a == b {
        return Err(LoreError::InvalidInput(
            "a political entity cannot be its own ally or rival".into(),
        ));
    }
    if relationship_type != ALLIED_WITH && relationship_type != RIVAL_OF {
        return Err(LoreError::InvalidInput(format!(
            "unsupported symmetric relationship type '{relationship_type}'"
        )));
    }

    if find_edge_either_direction(conn, a, b, relationship_type)?.is_some() {
        return Err(LoreError::InvalidInput(format!(
            "these political entities are already linked as {relationship_type}"
        )));
    }

    let opposite = if relationship_type == ALLIED_WITH { RIVAL_OF } else { ALLIED_WITH };
    if find_edge_either_direction(conn, a, b, opposite)?.is_some() {
        return Err(LoreError::InvalidInput(format!(
            "these political entities are already linked as {opposite}; a pair cannot be both allied and rivals"
        )));
    }

    relationships::create(
        conn,
        NewRelationship {
            source_entity_id: a.to_string(),
            target_entity_id: b.to_string(),
            relationship_type: relationship_type.to_string(),
            label: None,
            strength: None,
        },
    )
}

/// The political entities allied with `entity_id`, resolved regardless of
/// which side of the underlying relationship row `entity_id` happens to
/// be on (FR3.4, NFR3).
pub fn list_allies(conn: &Connection, entity_id: &str) -> Result<Vec<PoliticalEntity>> {
    list_symmetric_links(conn, entity_id, ALLIED_WITH)
}

/// The political entities that are rivals of `entity_id`. See
/// `list_allies`.
pub fn list_rivals(conn: &Connection, entity_id: &str) -> Result<Vec<PoliticalEntity>> {
    list_symmetric_links(conn, entity_id, RIVAL_OF)
}

fn list_symmetric_links(
    conn: &Connection,
    entity_id: &str,
    relationship_type: &str,
) -> Result<Vec<PoliticalEntity>> {
    let mut stmt = conn.prepare(
        "SELECT source_entity_id, target_entity_id FROM relationships
         WHERE relationship_type = ?1 AND deleted_at IS NULL
         AND (source_entity_id = ?2 OR target_entity_id = ?2)",
    )?;
    let rows = stmt.query_map(params![relationship_type, entity_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut out = Vec::new();
    for row in rows {
        let (source, target) = row?;
        let other_side = if source == entity_id { target } else { source };
        out.push(get(conn, &other_side)?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::locations;
    use crate::models::{NewCharacter, NewLocation, NewRelationship, CONTROLS, LEADS};

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewPoliticalEntity {
                name: "Meridian Concord".into(),
                classification: Some("alliance".into()),
                ideology: Some("Federalist expansionism.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Meridian Concord");
        assert_eq!(created.classification, "alliance");

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.ideology, "Federalist expansionism.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewPoliticalEntity::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_can_clear_founded_date_via_explicit_null() {
        let conn = setup();
        let created = create(
            &conn,
            NewPoliticalEntity { name: "Void Collective".into(), founded_date: Some("2100-01-01".into()), ..Default::default() },
        )
        .unwrap();
        assert_eq!(created.founded_date, Some("2100-01-01".to_string()));

        let cleared =
            update(&conn, &created.id, PoliticalEntityPatch { founded_date: Some(None), ..Default::default() }).unwrap();
        assert_eq!(cleared.founded_date, None);
    }

    #[test]
    fn list_filters_by_classification() {
        let conn = setup();
        create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), classification: Some("alliance".into()), ..Default::default() }).unwrap();
        create(&conn, NewPoliticalEntity { name: "Void Collective".into(), classification: Some("faction".into()), ..Default::default() }).unwrap();

        let alliances = list(&conn, &PoliticalEntityFilter { classification: Some("alliance".into()), ..Default::default() }).unwrap();
        assert_eq!(alliances.len(), 1);
        assert_eq!(alliances[0].name, "Meridian Concord");
    }

    #[test]
    fn character_can_lead_a_political_entity_via_relationships_table() {
        let conn = setup();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let entity = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: entity.id.clone(),
                relationship_type: LEADS.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &entity.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, LEADS);
        assert_eq!(links[0].source_entity_id, character.id);
    }

    #[test]
    fn political_entity_can_control_a_location_via_relationships_table() {
        let conn = setup();
        let entity = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();
        let location = locations::create(&conn, NewLocation { name: "New Geneva".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: entity.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: CONTROLS.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &location.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, CONTROLS);
        assert_eq!(links[0].source_entity_id, entity.id);
    }

    #[test]
    fn create_symmetric_edge_resolves_allies_regardless_of_initiating_direction() {
        let conn = setup();
        let concord = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();
        let collective = create(&conn, NewPoliticalEntity { name: "Void Collective".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &concord.id, &collective.id, ALLIED_WITH).unwrap();

        let concord_allies = list_allies(&conn, &concord.id).unwrap();
        assert_eq!(concord_allies.len(), 1);
        assert_eq!(concord_allies[0].id, collective.id);

        // Even though Meridian Concord initiated the link (as the
        // relationship's source), querying Void Collective's allies
        // resolves Meridian Concord correctly too (AC4/NFR3).
        let collective_allies = list_allies(&conn, &collective.id).unwrap();
        assert_eq!(collective_allies.len(), 1);
        assert_eq!(collective_allies[0].id, concord.id);
    }

    #[test]
    fn create_symmetric_edge_rejects_a_duplicate_in_the_reverse_direction() {
        let conn = setup();
        let concord = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();
        let collective = create(&conn, NewPoliticalEntity { name: "Void Collective".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &concord.id, &collective.id, ALLIED_WITH).unwrap();

        // The reverse direction is still the same pair -- rejected (AC5).
        let err = create_symmetric_edge(&conn, &collective.id, &concord.id, ALLIED_WITH).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));

        assert_eq!(list_allies(&conn, &concord.id).unwrap().len(), 1);
    }

    #[test]
    fn create_symmetric_edge_rejects_rival_of_when_allied_with_already_exists_and_vice_versa() {
        let conn = setup();
        let concord = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();
        let collective = create(&conn, NewPoliticalEntity { name: "Void Collective".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &concord.id, &collective.id, ALLIED_WITH).unwrap();

        // Can't also be rivals while allied (AC6), even from the reverse
        // direction.
        let err = create_symmetric_edge(&conn, &collective.id, &concord.id, RIVAL_OF).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
        assert!(list_rivals(&conn, &concord.id).unwrap().is_empty());

        // And the mirror case: rivals can't also become allies.
        let ashgard = create(&conn, NewPoliticalEntity { name: "Ashgard Dominion".into(), ..Default::default() }).unwrap();
        create_symmetric_edge(&conn, &concord.id, &ashgard.id, RIVAL_OF).unwrap();
        let err2 = create_symmetric_edge(&conn, &ashgard.id, &concord.id, ALLIED_WITH).unwrap_err();
        assert!(matches!(err2, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_symmetric_edge_rejects_a_self_link() {
        let conn = setup();
        let concord = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();

        let err = create_symmetric_edge(&conn, &concord.id, &concord.id, ALLIED_WITH).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn removing_an_alliance_removes_it_from_both_sides() {
        let conn = setup();
        let concord = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();
        let collective = create(&conn, NewPoliticalEntity { name: "Void Collective".into(), ..Default::default() }).unwrap();

        let edge = create_symmetric_edge(&conn, &concord.id, &collective.id, ALLIED_WITH).unwrap();
        relationships::delete(&conn, &edge.id).unwrap();

        assert!(list_allies(&conn, &concord.id).unwrap().is_empty());
        assert!(list_allies(&conn, &collective.id).unwrap().is_empty());
    }

    #[test]
    fn deleting_a_political_entity_cascades_all_relationship_types_without_touching_other_side() {
        let conn = setup();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let location = locations::create(&conn, NewLocation { name: "New Geneva".into(), ..Default::default() }).unwrap();
        let concord = create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), ..Default::default() }).unwrap();
        let collective = create(&conn, NewPoliticalEntity { name: "Void Collective".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: concord.id.clone(),
                relationship_type: LEADS.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: concord.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: CONTROLS.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        create_symmetric_edge(&conn, &concord.id, &collective.id, ALLIED_WITH).unwrap();

        delete(&conn, &concord.id).unwrap();

        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(relationships::list_for_entity(&conn, &location.id).unwrap().is_empty());
        assert!(list_allies(&conn, &collective.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive political entity deletion");
        assert!(locations::get(&conn, &location.id).is_ok(), "location must survive political entity deletion");
        assert!(get(&conn, &collective.id).is_ok(), "other political entity must survive deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewPoliticalEntity { name: "Revised Entity".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, PoliticalEntityPatch { ideology: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete");
        assert_eq!(history[2].action, "create");
    }
}
