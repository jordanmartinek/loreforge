use crate::error::{LoreError, Result};
use crate::hierarchy;
use crate::models::{MilitaryUnit, MilitaryUnitFilter, MilitaryUnitPatch, NewMilitaryUnit};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "military_unit";

fn row_to_unit(row: &Row) -> rusqlite::Result<MilitaryUnit> {
    Ok(MilitaryUnit {
        id: row.get("id")?,
        name: row.get("name")?,
        branch: row.get("branch")?,
        doctrine: row.get("doctrine")?,
        parent_unit_id: row.get("parent_unit_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    mud.branch, mud.doctrine, mud.parent_unit_id
";

pub fn get(conn: &Connection, id: &str) -> Result<MilitaryUnit> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN military_unit_details mud ON mud.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_unit)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("military unit {id} not found")))
}

/// Lists the direct subordinate units of `parent_id`, or top-of-chain
/// units (`parent_unit_id IS NULL`) when `parent_id` is `None` (FR2.1).
/// Chain of command is a strict tree, same structural role as Phase 4's
/// location hierarchy and Phase 6's species taxonomy, so the query shape
/// is identical to `locations::list_children` / `species::list_subspecies`.
pub fn list_subordinate_units(conn: &Connection, parent_id: Option<&str>) -> Result<Vec<MilitaryUnit>> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN military_unit_details mud ON mud.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL
         AND mud.parent_unit_id {} ORDER BY e.name COLLATE NOCASE ASC",
        if parent_id.is_some() { "= ?1" } else { "IS NULL" }
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = if let Some(pid) = parent_id {
        stmt.query_map(params![pid], row_to_unit)?
    } else {
        stmt.query_map([], row_to_unit)?
    };
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list(conn: &Connection, filter: &MilitaryUnitFilter) -> Result<Vec<MilitaryUnit>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN military_unit_details mud ON mud.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(branch) = filter.branch.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("mud.branch = ?".to_string());
        bind_values.push(branch.clone());
    }

    for cond in &conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }
    sql.push_str(" ORDER BY e.name COLLATE NOCASE ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> =
        bind_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params_refs.as_slice(), row_to_unit)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Returns true if setting `candidate_id`'s parent to `new_parent_id`
/// would make `candidate_id` its own ancestor -- i.e. `new_parent_id` is
/// `candidate_id` itself, or one of `candidate_id`'s own descendants
/// (FR1.3/FR3.3). This was the third independent copy of this exact
/// chain-walk algorithm (after `locations::would_create_cycle` and
/// `species::would_create_cycle`); Phase 9 extracted the shared logic
/// into `hierarchy.rs` once a fourth caller (Religions) arrived -- see
/// design-phase-9-religions.md section 1 (and design-phase-7-military.md
/// section 3.2 for why it wasn't extracted at the time this function was
/// first written).
pub fn would_create_cycle(conn: &Connection, candidate_id: &str, new_parent_id: &str) -> Result<bool> {
    Ok(hierarchy::would_create_cycle(candidate_id, new_parent_id, |id| {
        get(conn, id).ok().and_then(|u| u.parent_unit_id)
    }))
}

pub fn create(conn: &Connection, input: NewMilitaryUnit) -> Result<MilitaryUnit> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("military unit name is required".into()));
    }

    let branch = input.branch.unwrap_or_else(|| "other".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<MilitaryUnit> {
        if let Some(parent_id) = &input.parent_unit_id {
            get(conn, parent_id)
                .map_err(|_| LoreError::InvalidInput(format!("parent unit {parent_id} not found")))?;
        }

        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO military_unit_details (entity_id, branch, doctrine, parent_unit_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                id,
                branch,
                input.doctrine.unwrap_or_default(),
                input.parent_unit_id,
            ],
        )?;

        let unit = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&unit),
            None,
        )?;
        Ok(unit)
    })();

    match result {
        Ok(unit) => {
            conn.execute("COMMIT", [])?;
            Ok(unit)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Updates a military unit. Reparenting (a patch that sets
/// `parent_unit_id`) is validated against cycles (FR3.3) before any write
/// happens, in the same transaction as the rest of the update (NFR2).
pub fn update(conn: &Connection, id: &str, patch: MilitaryUnitPatch) -> Result<MilitaryUnit> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<MilitaryUnit> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(new_parent) = &patch.parent_unit_id {
            if let Some(new_parent_id) = new_parent {
                get(conn, new_parent_id)
                    .map_err(|_| LoreError::InvalidInput(format!("parent unit {new_parent_id} not found")))?;
                if would_create_cycle(conn, id, new_parent_id)? {
                    return Err(LoreError::InvalidInput(
                        "cannot set a unit's parent to itself or one of its own subordinate units".into(),
                    ));
                }
            }
        }

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("military unit name cannot be empty".into()));
            }
            conn.execute(
                "UPDATE entities SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )?;
        } else {
            conn.execute("UPDATE entities SET updated_at = ?1 WHERE id = ?2", params![now, id])?;
        }

        if let Some(branch) = &patch.branch {
            conn.execute(
                "UPDATE military_unit_details SET branch = ?1 WHERE entity_id = ?2",
                params![branch, id],
            )?;
        }
        if let Some(doctrine) = &patch.doctrine {
            conn.execute(
                "UPDATE military_unit_details SET doctrine = ?1 WHERE entity_id = ?2",
                params![doctrine, id],
            )?;
        }
        if let Some(new_parent) = &patch.parent_unit_id {
            conn.execute(
                "UPDATE military_unit_details SET parent_unit_id = ?1 WHERE entity_id = ?2",
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
        Ok(unit) => {
            conn.execute("COMMIT", [])?;
            Ok(unit)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the unit, reparenting its direct subordinate units to its
/// own parent (or to the top of the chain of command, if it had none) so
/// the subtree survives one level shallower rather than being orphaned or
/// cascade-deleted (FR3.1), and cascades any relationships touching it
/// (`serves_in`, `stationed_at`, and `equipped_with` links) without
/// affecting the characters/locations/technology on the other end
/// (FR3.2).
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<()> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE military_unit_details SET parent_unit_id = ?1 WHERE parent_unit_id = ?2",
            params![before.parent_unit_id, id],
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
    use crate::locations;
    use crate::models::{
        NewCharacter, NewLocation, NewRelationship, NewTechnology, EQUIPPED_WITH, SERVES_IN,
        STATIONED_AT,
    };
    use crate::relationships;
    use crate::technologies;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewMilitaryUnit {
                name: "1st Battalion".into(),
                branch: Some("army".into()),
                doctrine: Some("Combined-arms maneuver warfare.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "1st Battalion");
        assert_eq!(created.branch, "army");
        assert_eq!(created.parent_unit_id, None);

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.doctrine, "Combined-arms maneuver warfare.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewMilitaryUnit::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_nonexistent_parent() {
        let conn = setup();
        let err = create(
            &conn,
            NewMilitaryUnit {
                name: "Orphan Unit".into(),
                parent_unit_id: Some("does-not-exist".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn list_subordinate_units_returns_direct_children_including_root() {
        let conn = setup();
        let battalion =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();
        let company_a = create(
            &conn,
            NewMilitaryUnit { name: "Company A".into(), parent_unit_id: Some(battalion.id.clone()), ..Default::default() },
        )
        .unwrap();
        create(
            &conn,
            NewMilitaryUnit { name: "Company B".into(), parent_unit_id: Some(battalion.id.clone()), ..Default::default() },
        )
        .unwrap();

        let root_level = list_subordinate_units(&conn, None).unwrap();
        assert_eq!(root_level.len(), 1);
        assert_eq!(root_level[0].name, "1st Battalion");

        let battalion_children = list_subordinate_units(&conn, Some(&battalion.id)).unwrap();
        assert_eq!(battalion_children.len(), 2);

        let company_a_children = list_subordinate_units(&conn, Some(&company_a.id)).unwrap();
        assert!(company_a_children.is_empty());
    }

    #[test]
    fn setting_a_units_parent_to_its_own_descendant_is_rejected() {
        let conn = setup();
        let battalion =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();
        let company = create(
            &conn,
            NewMilitaryUnit { name: "Company A".into(), parent_unit_id: Some(battalion.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Moving 1st Battalion (ancestor) to become subordinate to Company
        // A (its own descendant) must be rejected (FR3.3/AC3).
        let err = update(
            &conn,
            &battalion.id,
            MilitaryUnitPatch { parent_unit_id: Some(Some(company.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));

        // A unit cannot become its own parent either.
        let err2 = update(
            &conn,
            &company.id,
            MilitaryUnitPatch { parent_unit_id: Some(Some(company.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err2, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_can_move_a_unit_to_a_valid_new_parent_or_back_to_root() {
        let conn = setup();
        let battalion_1 =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();
        let battalion_2 =
            create(&conn, NewMilitaryUnit { name: "2nd Battalion".into(), ..Default::default() }).unwrap();
        let company = create(
            &conn,
            NewMilitaryUnit { name: "Company A".into(), parent_unit_id: Some(battalion_1.id.clone()), ..Default::default() },
        )
        .unwrap();

        let moved = update(
            &conn,
            &company.id,
            MilitaryUnitPatch { parent_unit_id: Some(Some(battalion_2.id.clone())), ..Default::default() },
        )
        .unwrap();
        assert_eq!(moved.parent_unit_id, Some(battalion_2.id.clone()));

        let moved_to_root =
            update(&conn, &company.id, MilitaryUnitPatch { parent_unit_id: Some(None), ..Default::default() }).unwrap();
        assert_eq!(moved_to_root.parent_unit_id, None);
    }

    #[test]
    fn deleting_a_unit_reparents_its_subordinates_up_one_level() {
        let conn = setup();
        let battalion =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();
        let company = create(
            &conn,
            NewMilitaryUnit { name: "Company A".into(), parent_unit_id: Some(battalion.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Deleting 1st Battalion should leave Company A in place,
        // reparented to root (Battalion had no parent) rather than
        // orphaned/deleted (AC4).
        delete(&conn, &battalion.id).unwrap();

        let survived = get(&conn, &company.id).unwrap();
        assert_eq!(survived.parent_unit_id, None);

        let err = get(&conn, &battalion.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));
    }

    #[test]
    fn deleting_a_middle_unit_reparents_to_grandparent() {
        let conn = setup();
        let battalion =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();
        let company = create(
            &conn,
            NewMilitaryUnit { name: "Company A".into(), parent_unit_id: Some(battalion.id.clone()), ..Default::default() },
        )
        .unwrap();
        let platoon = create(
            &conn,
            NewMilitaryUnit { name: "1st Platoon".into(), parent_unit_id: Some(company.id.clone()), ..Default::default() },
        )
        .unwrap();

        delete(&conn, &company.id).unwrap();

        let survived = get(&conn, &platoon.id).unwrap();
        assert_eq!(survived.parent_unit_id, Some(battalion.id.clone()));
    }

    #[test]
    fn list_filters_by_branch() {
        let conn = setup();
        create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), branch: Some("army".into()), ..Default::default() }).unwrap();
        create(&conn, NewMilitaryUnit { name: "3rd Fleet".into(), branch: Some("navy".into()), ..Default::default() }).unwrap();
        create(&conn, NewMilitaryUnit { name: "Shadow Cell".into(), branch: Some("special_forces".into()), ..Default::default() }).unwrap();

        let navy = list(&conn, &MilitaryUnitFilter { branch: Some("navy".into()), ..Default::default() }).unwrap();
        assert_eq!(navy.len(), 1);
        assert_eq!(navy[0].name, "3rd Fleet");
    }

    #[test]
    fn character_can_serve_in_a_unit_via_relationships_table() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let unit =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: unit.id.clone(),
                relationship_type: SERVES_IN.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &unit.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, SERVES_IN);
        assert_eq!(links[0].source_entity_id, character.id);
    }

    #[test]
    fn unit_can_be_stationed_at_a_location_via_relationships_table() {
        let conn = setup();
        let unit =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();
        let location =
            locations::create(&conn, NewLocation { name: "Fort Meridian".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: unit.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: STATIONED_AT.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &location.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, STATIONED_AT);
        assert_eq!(links[0].source_entity_id, unit.id);
    }

    #[test]
    fn unit_can_be_equipped_with_a_technology_via_relationships_table() {
        let conn = setup();
        let unit =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();
        let tech =
            technologies::create(&conn, NewTechnology { name: "Rail Rifle".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: unit.id.clone(),
                target_entity_id: tech.id.clone(),
                relationship_type: EQUIPPED_WITH.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &tech.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, EQUIPPED_WITH);
        assert_eq!(links[0].source_entity_id, unit.id);
    }

    #[test]
    fn deleting_a_unit_cascades_all_three_relationship_types_without_touching_other_side() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let location =
            locations::create(&conn, NewLocation { name: "Fort Meridian".into(), ..Default::default() }).unwrap();
        let tech =
            technologies::create(&conn, NewTechnology { name: "Rail Rifle".into(), ..Default::default() }).unwrap();
        let unit =
            create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: unit.id.clone(),
                relationship_type: SERVES_IN.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: unit.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: STATIONED_AT.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: unit.id.clone(),
                target_entity_id: tech.id.clone(),
                relationship_type: EQUIPPED_WITH.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        delete(&conn, &unit.id).unwrap();

        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(relationships::list_for_entity(&conn, &location.id).unwrap().is_empty());
        assert!(relationships::list_for_entity(&conn, &tech.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive unit deletion");
        assert!(locations::get(&conn, &location.id).is_ok(), "location must survive unit deletion");
        assert!(technologies::get(&conn, &tech.id).is_ok(), "technology must survive unit deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created =
            create(&conn, NewMilitaryUnit { name: "Revised Unit".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, MilitaryUnitPatch { doctrine: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete");
        assert_eq!(history[2].action, "create");
    }
}
