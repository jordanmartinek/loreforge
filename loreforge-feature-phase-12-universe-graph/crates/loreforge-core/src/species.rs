use crate::error::{LoreError, Result};
use crate::hierarchy;
use crate::models::{NewSpecies, Species, SpeciesFilter, SpeciesPatch};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "species";

fn row_to_species(row: &Row) -> rusqlite::Result<Species> {
    Ok(Species {
        id: row.get("id")?,
        name: row.get("name")?,
        classification: row.get("classification")?,
        biology: row.get("biology")?,
        parent_species_id: row.get("parent_species_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    sd.classification, sd.biology, sd.parent_species_id
";

pub fn get(conn: &Connection, id: &str) -> Result<Species> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN species_details sd ON sd.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_species)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("species {id} not found")))
}

/// Lists the direct subspecies of `parent_id`, or root-level species
/// (`parent_species_id IS NULL`) when `parent_id` is `None` (FR2.1). This
/// is Phase 6's equivalent of `locations::list_children` -- taxonomy is a
/// strict tree, same as location hierarchy, so the query shape is
/// identical.
pub fn list_subspecies(conn: &Connection, parent_id: Option<&str>) -> Result<Vec<Species>> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN species_details sd ON sd.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL
         AND sd.parent_species_id {} ORDER BY e.name COLLATE NOCASE ASC",
        if parent_id.is_some() { "= ?1" } else { "IS NULL" }
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = if let Some(pid) = parent_id {
        stmt.query_map(params![pid], row_to_species)?
    } else {
        stmt.query_map([], row_to_species)?
    };
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list(conn: &Connection, filter: &SpeciesFilter) -> Result<Vec<Species>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN species_details sd ON sd.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(classification) = filter.classification.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("sd.classification = ?".to_string());
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

    let rows = stmt.query_map(params_refs.as_slice(), row_to_species)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Returns true if setting `candidate_id`'s parent to `new_parent_id` would
/// make `candidate_id` its own ancestor -- i.e. `new_parent_id` is
/// `candidate_id` itself, or one of `candidate_id`'s own descendants
/// (FR1.3/FR3.3). Delegates to the shared single-parent-tree chain-walk in
/// `hierarchy.rs` (extracted in Phase 9 -- see
/// design-phase-9-religions.md section 1; this function previously had
/// its own copy of the algorithm, ported directly from
/// `locations::would_create_cycle`).
pub fn would_create_cycle(conn: &Connection, candidate_id: &str, new_parent_id: &str) -> Result<bool> {
    Ok(hierarchy::would_create_cycle(candidate_id, new_parent_id, |id| {
        get(conn, id).ok().and_then(|s| s.parent_species_id)
    }))
}

pub fn create(conn: &Connection, input: NewSpecies) -> Result<Species> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("species name is required".into()));
    }

    let classification = input.classification.unwrap_or_else(|| "other".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Species> {
        // A brand-new species can't be its own ancestor, but its declared
        // parent must actually exist.
        if let Some(parent_id) = &input.parent_species_id {
            get(conn, parent_id)
                .map_err(|_| LoreError::InvalidInput(format!("parent species {parent_id} not found")))?;
        }

        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO species_details (entity_id, classification, biology, parent_species_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                id,
                classification,
                input.biology.unwrap_or_default(),
                input.parent_species_id,
            ],
        )?;

        let species = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&species),
            None,
        )?;
        Ok(species)
    })();

    match result {
        Ok(species) => {
            conn.execute("COMMIT", [])?;
            Ok(species)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Updates a species. Reparenting (a patch that sets `parent_species_id`)
/// is validated against cycles (FR3.3) before any write happens, in the
/// same transaction as the rest of the update (NFR2).
pub fn update(conn: &Connection, id: &str, patch: SpeciesPatch) -> Result<Species> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Species> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(new_parent) = &patch.parent_species_id {
            if let Some(new_parent_id) = new_parent {
                get(conn, new_parent_id)
                    .map_err(|_| LoreError::InvalidInput(format!("parent species {new_parent_id} not found")))?;
                if would_create_cycle(conn, id, new_parent_id)? {
                    return Err(LoreError::InvalidInput(
                        "cannot set a species' parent to itself or one of its own descendants".into(),
                    ));
                }
            }
        }

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("species name cannot be empty".into()));
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
                "UPDATE species_details SET classification = ?1 WHERE entity_id = ?2",
                params![classification, id],
            )?;
        }
        if let Some(biology) = &patch.biology {
            conn.execute(
                "UPDATE species_details SET biology = ?1 WHERE entity_id = ?2",
                params![biology, id],
            )?;
        }
        if let Some(new_parent) = &patch.parent_species_id {
            conn.execute(
                "UPDATE species_details SET parent_species_id = ?1 WHERE entity_id = ?2",
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
        Ok(species) => {
            conn.execute("COMMIT", [])?;
            Ok(species)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the species, reparenting its direct subspecies to its own
/// parent (or to root, if it had none) so the subtree survives one level
/// shallower rather than being orphaned or cascade-deleted (FR3.1), and
/// cascades any relationships touching it (`member_of` and `native_to`
/// links) without affecting the characters/locations on the other end
/// (FR3.2).
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<()> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE species_details SET parent_species_id = ?1 WHERE parent_species_id = ?2",
            params![before.parent_species_id, id],
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
    use crate::models::{NewCharacter, NewLocation, NewRelationship, MEMBER_OF, NATIVE_TO};
    use crate::relationships;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewSpecies {
                name: "Elari".into(),
                classification: Some("sentient_humanoid".into()),
                biology: Some("Long-lived, photosynthetic skin.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Elari");
        assert_eq!(created.classification, "sentient_humanoid");
        assert_eq!(created.parent_species_id, None);

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.biology, "Long-lived, photosynthetic skin.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewSpecies::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_nonexistent_parent() {
        let conn = setup();
        let err = create(
            &conn,
            NewSpecies {
                name: "Orphan Species".into(),
                parent_species_id: Some("does-not-exist".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn list_subspecies_returns_direct_children_including_root() {
        let conn = setup();
        let elari = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();
        let sub_saharan = create(
            &conn,
            NewSpecies { name: "Sub-Saharan Elari".into(), parent_species_id: Some(elari.id.clone()), ..Default::default() },
        )
        .unwrap();
        create(
            &conn,
            NewSpecies { name: "Coastal Elari".into(), parent_species_id: Some(elari.id.clone()), ..Default::default() },
        )
        .unwrap();

        let root_level = list_subspecies(&conn, None).unwrap();
        assert_eq!(root_level.len(), 1);
        assert_eq!(root_level[0].name, "Elari");

        let elari_children = list_subspecies(&conn, Some(&elari.id)).unwrap();
        assert_eq!(elari_children.len(), 2);

        let sub_saharan_children = list_subspecies(&conn, Some(&sub_saharan.id)).unwrap();
        assert!(sub_saharan_children.is_empty());
    }

    #[test]
    fn setting_a_species_parent_to_its_own_descendant_is_rejected() {
        let conn = setup();
        let elari = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();
        let sub_saharan = create(
            &conn,
            NewSpecies { name: "Sub-Saharan Elari".into(), parent_species_id: Some(elari.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Moving Elari (ancestor) to become a child of Sub-Saharan Elari
        // (its own descendant) must be rejected (FR3.3/AC3).
        let err = update(
            &conn,
            &elari.id,
            SpeciesPatch { parent_species_id: Some(Some(sub_saharan.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));

        // A species cannot become its own parent either.
        let err2 = update(
            &conn,
            &sub_saharan.id,
            SpeciesPatch { parent_species_id: Some(Some(sub_saharan.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err2, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_can_move_a_species_to_a_valid_new_parent_or_back_to_root() {
        let conn = setup();
        let elari = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();
        let vex_kin = create(&conn, NewSpecies { name: "Vex-Kin".into(), ..Default::default() }).unwrap();
        let sub_saharan = create(
            &conn,
            NewSpecies { name: "Sub-Saharan Elari".into(), parent_species_id: Some(elari.id.clone()), ..Default::default() },
        )
        .unwrap();

        let moved = update(
            &conn,
            &sub_saharan.id,
            SpeciesPatch { parent_species_id: Some(Some(vex_kin.id.clone())), ..Default::default() },
        )
        .unwrap();
        assert_eq!(moved.parent_species_id, Some(vex_kin.id.clone()));

        let moved_to_root =
            update(&conn, &sub_saharan.id, SpeciesPatch { parent_species_id: Some(None), ..Default::default() }).unwrap();
        assert_eq!(moved_to_root.parent_species_id, None);
    }

    #[test]
    fn deleting_a_species_reparents_its_subspecies_up_one_level() {
        let conn = setup();
        let elari = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();
        let sub_saharan = create(
            &conn,
            NewSpecies { name: "Sub-Saharan Elari".into(), parent_species_id: Some(elari.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Deleting Elari should leave Sub-Saharan Elari in place, reparented
        // to root (Elari had no parent) rather than orphaned/deleted (AC4).
        delete(&conn, &elari.id).unwrap();

        let survived = get(&conn, &sub_saharan.id).unwrap();
        assert_eq!(survived.parent_species_id, None);

        let err = get(&conn, &elari.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));
    }

    #[test]
    fn deleting_a_middle_species_reparents_to_grandparent() {
        let conn = setup();
        let elari = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();
        let sub_saharan = create(
            &conn,
            NewSpecies { name: "Sub-Saharan Elari".into(), parent_species_id: Some(elari.id.clone()), ..Default::default() },
        )
        .unwrap();
        let coastal = create(
            &conn,
            NewSpecies { name: "Coastal Sub-Saharan Elari".into(), parent_species_id: Some(sub_saharan.id.clone()), ..Default::default() },
        )
        .unwrap();

        delete(&conn, &sub_saharan.id).unwrap();

        let survived = get(&conn, &coastal.id).unwrap();
        assert_eq!(survived.parent_species_id, Some(elari.id.clone()));
    }

    #[test]
    fn list_filters_by_classification() {
        let conn = setup();
        create(&conn, NewSpecies { name: "Elari".into(), classification: Some("sentient_humanoid".into()), ..Default::default() }).unwrap();
        create(&conn, NewSpecies { name: "Void Wisp".into(), classification: Some("synthetic".into()), ..Default::default() }).unwrap();
        create(&conn, NewSpecies { name: "Sky Ray".into(), classification: Some("non_sentient_fauna".into()), ..Default::default() }).unwrap();

        let synthetic = list(&conn, &SpeciesFilter { classification: Some("synthetic".into()), ..Default::default() }).unwrap();
        assert_eq!(synthetic.len(), 1);
        assert_eq!(synthetic[0].name, "Void Wisp");
    }

    #[test]
    fn character_can_be_a_member_of_a_species_via_relationships_table() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let species = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: species.id.clone(),
                relationship_type: MEMBER_OF.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &species.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, MEMBER_OF);
        assert_eq!(links[0].source_entity_id, character.id);
    }

    #[test]
    fn species_can_be_native_to_a_location_via_relationships_table() {
        let conn = setup();
        let species = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();
        let location =
            locations::create(&conn, NewLocation { name: "New Geneva".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: species.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: NATIVE_TO.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &location.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, NATIVE_TO);
        assert_eq!(links[0].source_entity_id, species.id);
    }

    #[test]
    fn deleting_a_species_cascades_member_of_and_native_to_without_touching_other_side() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let location =
            locations::create(&conn, NewLocation { name: "New Geneva".into(), ..Default::default() }).unwrap();
        let species = create(&conn, NewSpecies { name: "Elari".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: species.id.clone(),
                relationship_type: MEMBER_OF.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: species.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: NATIVE_TO.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        delete(&conn, &species.id).unwrap();

        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(relationships::list_for_entity(&conn, &location.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive species deletion");
        assert!(locations::get(&conn, &location.id).is_ok(), "location must survive species deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewSpecies { name: "Revised Species".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, SpeciesPatch { biology: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete");
        assert_eq!(history[2].action, "create");
    }
}
