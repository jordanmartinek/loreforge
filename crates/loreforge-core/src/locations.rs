use crate::error::{LoreError, Result};
use crate::models::{Location, LocationFilter, LocationPatch, NewLocation};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "location";

fn row_to_location(row: &Row) -> rusqlite::Result<Location> {
    Ok(Location {
        id: row.get("id")?,
        name: row.get("name")?,
        location_type: row.get("location_type")?,
        description: row.get("description")?,
        parent_location_id: row.get("parent_location_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    ld.location_type, ld.description, ld.parent_location_id
";

pub fn get(conn: &Connection, id: &str) -> Result<Location> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN location_details ld ON ld.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_location)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("location {id} not found")))
}

/// Walks up the tree from `starting_id`, collecting ancestors, immediate
/// parent first, root last (FR2.2). Stops at the first location with no
/// parent, or if it would revisit a location already seen (defensive
/// against a cycle that somehow got into the data despite the write-side
/// guards -- ensures this function itself can never loop forever).
pub fn get_ancestry_chain(conn: &Connection, starting_id: &str) -> Result<Vec<Location>> {
    let mut chain = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut current = get(conn, starting_id)?.parent_location_id;

    while let Some(parent_id) = current {
        if !seen.insert(parent_id.clone()) {
            break; // would-be cycle; stop rather than loop forever
        }
        let parent = get(conn, &parent_id)?;
        current = parent.parent_location_id.clone();
        chain.push(parent);
    }

    Ok(chain)
}

/// Returns true if setting `candidate_id`'s parent to `new_parent_id` would
/// make `candidate_id` its own ancestor -- i.e. `new_parent_id` is
/// `candidate_id` itself, or one of `candidate_id`'s own descendants
/// (FR1.3/FR3.3). Checked by walking up from `new_parent_id`: if we ever
/// reach `candidate_id`, the move would create a cycle.
pub fn would_create_cycle(conn: &Connection, candidate_id: &str, new_parent_id: &str) -> Result<bool> {
    if candidate_id == new_parent_id {
        return Ok(true);
    }

    let mut seen = std::collections::HashSet::new();
    let mut current = Some(new_parent_id.to_string());

    while let Some(id) = current {
        if id == candidate_id {
            return Ok(true);
        }
        if !seen.insert(id.clone()) {
            break; // already-existing cycle elsewhere; don't loop forever
        }
        current = get(conn, &id).ok().and_then(|l| l.parent_location_id);
    }

    Ok(false)
}

/// Lists the direct children of `parent_id`, or root-level locations
/// (`parent_location_id IS NULL`) when `parent_id` is `None` (FR2.1).
pub fn list_children(conn: &Connection, parent_id: Option<&str>) -> Result<Vec<Location>> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN location_details ld ON ld.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL
         AND ld.parent_location_id {} ORDER BY e.name COLLATE NOCASE ASC",
        if parent_id.is_some() { "= ?1" } else { "IS NULL" }
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = if let Some(pid) = parent_id {
        stmt.query_map(params![pid], row_to_location)?
    } else {
        stmt.query_map([], row_to_location)?
    };
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list(conn: &Connection, filter: &LocationFilter) -> Result<Vec<Location>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN location_details ld ON ld.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(location_type) = filter.location_type.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("ld.location_type = ?".to_string());
        bind_values.push(location_type.clone());
    }

    for cond in &conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }
    sql.push_str(" ORDER BY e.name COLLATE NOCASE ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> =
        bind_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params_refs.as_slice(), row_to_location)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn create(conn: &Connection, input: NewLocation) -> Result<Location> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("location name is required".into()));
    }

    let location_type = input.location_type.unwrap_or_else(|| "other".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Location> {
        // A brand-new location can't be its own ancestor, but its declared
        // parent must actually exist.
        if let Some(parent_id) = &input.parent_location_id {
            get(conn, parent_id)
                .map_err(|_| LoreError::InvalidInput(format!("parent location {parent_id} not found")))?;
        }

        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO location_details (entity_id, location_type, description, parent_location_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                id,
                location_type,
                input.description.unwrap_or_default(),
                input.parent_location_id,
            ],
        )?;

        let location = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&location),
            None,
        )?;
        Ok(location)
    })();

    match result {
        Ok(location) => {
            conn.execute("COMMIT", [])?;
            Ok(location)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Updates a location. Reparenting (a patch that sets `parent_location_id`)
/// is validated against cycles (FR3.3) before any write happens, in the
/// same transaction as the rest of the update (NFR3).
pub fn update(conn: &Connection, id: &str, patch: LocationPatch) -> Result<Location> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Location> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(new_parent) = &patch.parent_location_id {
            if let Some(new_parent_id) = new_parent {
                get(conn, new_parent_id)
                    .map_err(|_| LoreError::InvalidInput(format!("parent location {new_parent_id} not found")))?;
                if would_create_cycle(conn, id, new_parent_id)? {
                    return Err(LoreError::InvalidInput(
                        "cannot move a location to become a child of itself or one of its own descendants".into(),
                    ));
                }
            }
        }

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("location name cannot be empty".into()));
            }
            conn.execute(
                "UPDATE entities SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )?;
        } else {
            conn.execute("UPDATE entities SET updated_at = ?1 WHERE id = ?2", params![now, id])?;
        }

        if let Some(location_type) = &patch.location_type {
            conn.execute(
                "UPDATE location_details SET location_type = ?1 WHERE entity_id = ?2",
                params![location_type, id],
            )?;
        }
        if let Some(description) = &patch.description {
            conn.execute(
                "UPDATE location_details SET description = ?1 WHERE entity_id = ?2",
                params![description, id],
            )?;
        }
        if let Some(new_parent) = &patch.parent_location_id {
            conn.execute(
                "UPDATE location_details SET parent_location_id = ?1 WHERE entity_id = ?2",
                params![new_parent, id],
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
        Ok(location) => {
            conn.execute("COMMIT", [])?;
            Ok(location)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the location, reparenting its direct children to its own
/// parent (or to root, if it had none) so the subtree survives one level
/// shallower rather than being orphaned or cascade-deleted (FR3.1), and
/// cascades any relationships touching it (e.g. `located_at` links) without
/// affecting the characters/events on the other end (FR3.2).
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<()> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE location_details SET parent_location_id = ?1 WHERE parent_location_id = ?2",
            params![before.parent_location_id, id],
        )?;

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
    use crate::models::{NewCharacter, NewRelationship, LOCATED_AT};
    use crate::relationships;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewLocation {
                name: "Sol System".into(),
                location_type: Some("solar_system".into()),
                description: Some("Home system of the Sol Federation.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Sol System");
        assert_eq!(created.location_type, "solar_system");
        assert_eq!(created.parent_location_id, None);

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.description, "Home system of the Sol Federation.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewLocation::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_nonexistent_parent() {
        let conn = setup();
        let err = create(
            &conn,
            NewLocation {
                name: "Orphan".into(),
                parent_location_id: Some("does-not-exist".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn list_children_returns_direct_children_including_root() {
        let conn = setup();
        let sol = create(&conn, NewLocation { name: "Sol System".into(), ..Default::default() }).unwrap();
        let earth = create(
            &conn,
            NewLocation { name: "Earth".into(), parent_location_id: Some(sol.id.clone()), ..Default::default() },
        )
        .unwrap();
        create(
            &conn,
            NewLocation { name: "New Geneva".into(), parent_location_id: Some(earth.id.clone()), ..Default::default() },
        )
        .unwrap();

        let root_level = list_children(&conn, None).unwrap();
        assert_eq!(root_level.len(), 1);
        assert_eq!(root_level[0].name, "Sol System");

        let sol_children = list_children(&conn, Some(&sol.id)).unwrap();
        assert_eq!(sol_children.len(), 1);
        assert_eq!(sol_children[0].name, "Earth");

        let earth_children = list_children(&conn, Some(&earth.id)).unwrap();
        assert_eq!(earth_children.len(), 1);
        assert_eq!(earth_children[0].name, "New Geneva");
    }

    #[test]
    fn get_ancestry_chain_returns_immediate_parent_first_root_last() {
        let conn = setup();
        let sol = create(&conn, NewLocation { name: "Sol System".into(), ..Default::default() }).unwrap();
        let earth = create(
            &conn,
            NewLocation { name: "Earth".into(), parent_location_id: Some(sol.id.clone()), ..Default::default() },
        )
        .unwrap();
        let geneva = create(
            &conn,
            NewLocation { name: "New Geneva".into(), parent_location_id: Some(earth.id.clone()), ..Default::default() },
        )
        .unwrap();

        let chain = get_ancestry_chain(&conn, &geneva.id).unwrap();
        assert_eq!(chain.len(), 2);
        assert_eq!(chain[0].name, "Earth"); // immediate parent first
        assert_eq!(chain[1].name, "Sol System"); // root last

        let root_chain = get_ancestry_chain(&conn, &sol.id).unwrap();
        assert!(root_chain.is_empty());
    }

    #[test]
    fn moving_a_location_to_become_child_of_its_own_descendant_is_rejected() {
        let conn = setup();
        let sol = create(&conn, NewLocation { name: "Sol System".into(), ..Default::default() }).unwrap();
        let earth = create(
            &conn,
            NewLocation { name: "Earth".into(), parent_location_id: Some(sol.id.clone()), ..Default::default() },
        )
        .unwrap();
        let geneva = create(
            &conn,
            NewLocation { name: "New Geneva".into(), parent_location_id: Some(earth.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Moving Sol System (ancestor) to become a child of New Geneva
        // (its own descendant) must be rejected (FR3.3/AC4).
        let err = update(
            &conn,
            &sol.id,
            LocationPatch { parent_location_id: Some(Some(geneva.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));

        // A location cannot become its own parent either.
        let err2 = update(
            &conn,
            &earth.id,
            LocationPatch { parent_location_id: Some(Some(earth.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err2, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_can_move_a_location_to_a_valid_new_parent() {
        let conn = setup();
        let sol = create(&conn, NewLocation { name: "Sol System".into(), ..Default::default() }).unwrap();
        let alpha_centauri =
            create(&conn, NewLocation { name: "Alpha Centauri".into(), ..Default::default() }).unwrap();
        let earth = create(
            &conn,
            NewLocation { name: "Earth".into(), parent_location_id: Some(sol.id.clone()), ..Default::default() },
        )
        .unwrap();

        let moved = update(
            &conn,
            &earth.id,
            LocationPatch { parent_location_id: Some(Some(alpha_centauri.id.clone())), ..Default::default() },
        )
        .unwrap();
        assert_eq!(moved.parent_location_id, Some(alpha_centauri.id.clone()));

        // Moving to root (explicit null) also works (Option<Option<String>> pattern).
        let moved_to_root =
            update(&conn, &earth.id, LocationPatch { parent_location_id: Some(None), ..Default::default() }).unwrap();
        assert_eq!(moved_to_root.parent_location_id, None);
    }

    #[test]
    fn deleting_a_location_reparents_its_children_up_one_level() {
        let conn = setup();
        let sol = create(&conn, NewLocation { name: "Sol System".into(), ..Default::default() }).unwrap();
        let earth = create(
            &conn,
            NewLocation { name: "Earth".into(), parent_location_id: Some(sol.id.clone()), ..Default::default() },
        )
        .unwrap();
        let geneva = create(
            &conn,
            NewLocation { name: "New Geneva".into(), parent_location_id: Some(earth.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Deleting Earth (the middle location) should reparent New Geneva
        // directly under Sol System -- not delete it, not orphan it (AC3).
        delete(&conn, &earth.id).unwrap();

        let survived = get(&conn, &geneva.id).unwrap();
        assert_eq!(survived.parent_location_id, Some(sol.id.clone()));

        let err = get(&conn, &earth.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));
    }

    #[test]
    fn deleting_a_root_location_reparents_children_to_root() {
        let conn = setup();
        let sol = create(&conn, NewLocation { name: "Sol System".into(), ..Default::default() }).unwrap();
        let earth = create(
            &conn,
            NewLocation { name: "Earth".into(), parent_location_id: Some(sol.id.clone()), ..Default::default() },
        )
        .unwrap();

        delete(&conn, &sol.id).unwrap();

        let survived = get(&conn, &earth.id).unwrap();
        assert_eq!(survived.parent_location_id, None); // reparented to root
    }

    #[test]
    fn character_can_be_located_at_a_location_via_relationships_table() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let location = create(&conn, NewLocation { name: "New Geneva".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: LOCATED_AT.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &location.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, LOCATED_AT);
        assert_eq!(links[0].source_entity_id, character.id);
    }

    #[test]
    fn deleting_a_location_cascades_located_at_without_touching_the_character() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let location = create(&conn, NewLocation { name: "New Geneva".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: LOCATED_AT.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        delete(&conn, &location.id).unwrap();

        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive location deletion");
    }

    #[test]
    fn list_filters_by_location_type() {
        let conn = setup();
        create(&conn, NewLocation { name: "Sol System".into(), location_type: Some("solar_system".into()), ..Default::default() }).unwrap();
        create(&conn, NewLocation { name: "Earth".into(), location_type: Some("planet".into()), ..Default::default() }).unwrap();
        create(&conn, NewLocation { name: "Mars".into(), location_type: Some("planet".into()), ..Default::default() }).unwrap();

        let planets = list(&conn, &LocationFilter { location_type: Some("planet".into()), ..Default::default() }).unwrap();
        assert_eq!(planets.len(), 2);
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewLocation { name: "Revised Location".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, LocationPatch { description: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete");
        assert_eq!(history[2].action, "create");
    }
}
