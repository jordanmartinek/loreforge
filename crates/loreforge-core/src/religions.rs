use crate::error::{LoreError, Result};
use crate::hierarchy;
use crate::models::{NewReligion, Religion, ReligionFilter, ReligionPatch};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "religion";

fn row_to_religion(row: &Row) -> rusqlite::Result<Religion> {
    Ok(Religion {
        id: row.get("id")?,
        name: row.get("name")?,
        classification: row.get("classification")?,
        tenets: row.get("tenets")?,
        parent_religion_id: row.get("parent_religion_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    rd.classification, rd.tenets, rd.parent_religion_id
";

pub fn get(conn: &Connection, id: &str) -> Result<Religion> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN religion_details rd ON rd.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_religion)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("religion {id} not found")))
}

/// Lists the direct schisms/denominations of `parent_id`, or root-level
/// religions (`parent_religion_id IS NULL`) when `parent_id` is `None`
/// (FR3.1). Schism structure is a strict tree, same structural role as
/// Phase 4/6/7's location hierarchy/species taxonomy/chain of command, so
/// the query shape is identical to `locations::list_children` /
/// `species::list_subspecies` / `military::list_subordinate_units`.
pub fn list_schisms(conn: &Connection, parent_id: Option<&str>) -> Result<Vec<Religion>> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN religion_details rd ON rd.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL
         AND rd.parent_religion_id {} ORDER BY e.name COLLATE NOCASE ASC",
        if parent_id.is_some() { "= ?1" } else { "IS NULL" }
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = if let Some(pid) = parent_id {
        stmt.query_map(params![pid], row_to_religion)?
    } else {
        stmt.query_map([], row_to_religion)?
    };
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list(conn: &Connection, filter: &ReligionFilter) -> Result<Vec<Religion>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN religion_details rd ON rd.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(classification) = filter.classification.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("rd.classification = ?".to_string());
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

    let rows = stmt.query_map(params_refs.as_slice(), row_to_religion)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Returns true if setting `candidate_id`'s parent to `new_parent_id`
/// would make `candidate_id` its own ancestor (FR2.3/FR3.5). Delegates to
/// the shared single-parent-tree chain-walk in `hierarchy.rs` -- Religions
/// is the first entity type to use the shared helper from day one rather
/// than starting with its own copy (design-phase-9-religions.md section
/// 1, which is this phase's motivating reason to extract the helper at
/// all).
pub fn would_create_cycle(conn: &Connection, candidate_id: &str, new_parent_id: &str) -> Result<bool> {
    Ok(hierarchy::would_create_cycle(candidate_id, new_parent_id, |id| {
        get(conn, id).ok().and_then(|r| r.parent_religion_id)
    }))
}

pub fn create(conn: &Connection, input: NewReligion) -> Result<Religion> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("religion name is required".into()));
    }

    let classification = input.classification.unwrap_or_else(|| "other".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Religion> {
        if let Some(parent_id) = &input.parent_religion_id {
            get(conn, parent_id)
                .map_err(|_| LoreError::InvalidInput(format!("parent religion {parent_id} not found")))?;
        }

        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO religion_details (entity_id, classification, tenets, parent_religion_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                id,
                classification,
                input.tenets.unwrap_or_default(),
                input.parent_religion_id,
            ],
        )?;

        let religion = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&religion),
            None,
        )?;
        Ok(religion)
    })();

    match result {
        Ok(religion) => {
            conn.execute("COMMIT", [])?;
            Ok(religion)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Updates a religion. Reparenting (a patch that sets
/// `parent_religion_id`) is validated against cycles (FR3.5) before any
/// write happens, in the same transaction as the rest of the update
/// (NFR2).
pub fn update(conn: &Connection, id: &str, patch: ReligionPatch) -> Result<Religion> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Religion> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(new_parent) = &patch.parent_religion_id {
            if let Some(new_parent_id) = new_parent {
                get(conn, new_parent_id)
                    .map_err(|_| LoreError::InvalidInput(format!("parent religion {new_parent_id} not found")))?;
                if would_create_cycle(conn, id, new_parent_id)? {
                    return Err(LoreError::InvalidInput(
                        "cannot set a religion's parent to itself or one of its own schisms".into(),
                    ));
                }
            }
        }

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("religion name cannot be empty".into()));
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
                "UPDATE religion_details SET classification = ?1 WHERE entity_id = ?2",
                params![classification, id],
            )?;
        }
        if let Some(tenets) = &patch.tenets {
            conn.execute(
                "UPDATE religion_details SET tenets = ?1 WHERE entity_id = ?2",
                params![tenets, id],
            )?;
        }
        if let Some(new_parent) = &patch.parent_religion_id {
            conn.execute(
                "UPDATE religion_details SET parent_religion_id = ?1 WHERE entity_id = ?2",
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
        Ok(religion) => {
            conn.execute("COMMIT", [])?;
            Ok(religion)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the religion, reparenting its direct schisms to its own
/// parent (or to root, if it had none) so the subtree survives one level
/// shallower rather than being orphaned or cascade-deleted (FR3.3), and
/// cascades any relationships touching it (`follows` and `holy_site`
/// links) without affecting the characters/locations on the other end
/// (FR3.4).
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<()> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE religion_details SET parent_religion_id = ?1 WHERE parent_religion_id = ?2",
            params![before.parent_religion_id, id],
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
    use crate::models::{NewCharacter, NewLocation, NewRelationship, FOLLOWS, HOLY_SITE};
    use crate::relationships;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewReligion {
                name: "Solari Faith".into(),
                classification: Some("organized_religion".into()),
                tenets: Some("The sun as the source of all life and judgment.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Solari Faith");
        assert_eq!(created.classification, "organized_religion");
        assert_eq!(created.parent_religion_id, None);

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.tenets, "The sun as the source of all life and judgment.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewReligion::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_nonexistent_parent() {
        let conn = setup();
        let err = create(
            &conn,
            NewReligion {
                name: "Orphan Faith".into(),
                parent_religion_id: Some("does-not-exist".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn list_schisms_returns_direct_children_including_root() {
        let conn = setup();
        let solari = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();
        let reformed = create(
            &conn,
            NewReligion { name: "Reformed Solari Rite".into(), parent_religion_id: Some(solari.id.clone()), ..Default::default() },
        )
        .unwrap();
        create(
            &conn,
            NewReligion { name: "Orthodox Solari Rite".into(), parent_religion_id: Some(solari.id.clone()), ..Default::default() },
        )
        .unwrap();

        let root_level = list_schisms(&conn, None).unwrap();
        assert_eq!(root_level.len(), 1);
        assert_eq!(root_level[0].name, "Solari Faith");

        let solari_children = list_schisms(&conn, Some(&solari.id)).unwrap();
        assert_eq!(solari_children.len(), 2);

        let reformed_children = list_schisms(&conn, Some(&reformed.id)).unwrap();
        assert!(reformed_children.is_empty());
    }

    #[test]
    fn setting_a_religions_parent_to_its_own_descendant_is_rejected() {
        let conn = setup();
        let solari = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();
        let reformed = create(
            &conn,
            NewReligion { name: "Reformed Solari Rite".into(), parent_religion_id: Some(solari.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Moving Solari Faith (ancestor) to become a schism of Reformed
        // Solari Rite (its own descendant) must be rejected (FR3.5/AC3).
        let err = update(
            &conn,
            &solari.id,
            ReligionPatch { parent_religion_id: Some(Some(reformed.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));

        // A religion cannot become its own parent either.
        let err2 = update(
            &conn,
            &reformed.id,
            ReligionPatch { parent_religion_id: Some(Some(reformed.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err2, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_can_move_a_religion_to_a_valid_new_parent_or_back_to_root() {
        let conn = setup();
        let solari = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();
        let lunar = create(&conn, NewReligion { name: "Lunar Rite".into(), ..Default::default() }).unwrap();
        let reformed = create(
            &conn,
            NewReligion { name: "Reformed Solari Rite".into(), parent_religion_id: Some(solari.id.clone()), ..Default::default() },
        )
        .unwrap();

        let moved = update(
            &conn,
            &reformed.id,
            ReligionPatch { parent_religion_id: Some(Some(lunar.id.clone())), ..Default::default() },
        )
        .unwrap();
        assert_eq!(moved.parent_religion_id, Some(lunar.id.clone()));

        let moved_to_root =
            update(&conn, &reformed.id, ReligionPatch { parent_religion_id: Some(None), ..Default::default() }).unwrap();
        assert_eq!(moved_to_root.parent_religion_id, None);
    }

    #[test]
    fn deleting_a_religion_reparents_its_schisms_up_one_level() {
        let conn = setup();
        let solari = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();
        let reformed = create(
            &conn,
            NewReligion { name: "Reformed Solari Rite".into(), parent_religion_id: Some(solari.id.clone()), ..Default::default() },
        )
        .unwrap();

        // Deleting Solari Faith should leave Reformed Solari Rite in
        // place, reparented to root (Solari Faith had no parent) rather
        // than orphaned/deleted (AC4).
        delete(&conn, &solari.id).unwrap();

        let survived = get(&conn, &reformed.id).unwrap();
        assert_eq!(survived.parent_religion_id, None);

        let err = get(&conn, &solari.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));
    }

    #[test]
    fn deleting_a_middle_religion_reparents_to_grandparent() {
        let conn = setup();
        let solari = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();
        let reformed = create(
            &conn,
            NewReligion { name: "Reformed Solari Rite".into(), parent_religion_id: Some(solari.id.clone()), ..Default::default() },
        )
        .unwrap();
        let breakaway = create(
            &conn,
            NewReligion { name: "Breakaway Reformed Circle".into(), parent_religion_id: Some(reformed.id.clone()), ..Default::default() },
        )
        .unwrap();

        delete(&conn, &reformed.id).unwrap();

        let survived = get(&conn, &breakaway.id).unwrap();
        assert_eq!(survived.parent_religion_id, Some(solari.id.clone()));
    }

    #[test]
    fn list_filters_by_classification() {
        let conn = setup();
        create(&conn, NewReligion { name: "Solari Faith".into(), classification: Some("organized_religion".into()), ..Default::default() }).unwrap();
        create(&conn, NewReligion { name: "Whisper Cult".into(), classification: Some("cult".into()), ..Default::default() }).unwrap();
        create(&conn, NewReligion { name: "Void Reckoning".into(), classification: Some("philosophy".into()), ..Default::default() }).unwrap();

        let cults = list(&conn, &ReligionFilter { classification: Some("cult".into()), ..Default::default() }).unwrap();
        assert_eq!(cults.len(), 1);
        assert_eq!(cults[0].name, "Whisper Cult");
    }

    #[test]
    fn character_can_follow_a_religion_via_relationships_table() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let religion = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: religion.id.clone(),
                relationship_type: FOLLOWS.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &religion.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, FOLLOWS);
        assert_eq!(links[0].source_entity_id, character.id);
    }

    #[test]
    fn religion_can_consider_a_location_a_holy_site_via_relationships_table() {
        let conn = setup();
        let religion = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();
        let location = locations::create(&conn, NewLocation { name: "Sunspire Temple".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: religion.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: HOLY_SITE.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &location.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, HOLY_SITE);
        assert_eq!(links[0].source_entity_id, religion.id);
    }

    #[test]
    fn deleting_a_religion_cascades_follows_and_holy_site_without_touching_other_side() {
        let conn = setup();
        let character =
            characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let location = locations::create(&conn, NewLocation { name: "Sunspire Temple".into(), ..Default::default() }).unwrap();
        let religion = create(&conn, NewReligion { name: "Solari Faith".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: religion.id.clone(),
                relationship_type: FOLLOWS.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: religion.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: HOLY_SITE.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        delete(&conn, &religion.id).unwrap();

        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(relationships::list_for_entity(&conn, &location.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive religion deletion");
        assert!(locations::get(&conn, &location.id).is_ok(), "location must survive religion deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewReligion { name: "Revised Religion".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, ReligionPatch { tenets: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete");
        assert_eq!(history[2].action, "create");
    }
}
