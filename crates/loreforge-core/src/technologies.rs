use crate::error::{LoreError, Result};
use crate::models::{
    NewRelationship, NewTechnology, Relationship, Technology, TechnologyFilter, TechnologyPatch,
    REQUIRES,
};
use crate::relationships;
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::collections::HashSet;
use uuid::Uuid;

const ENTITY_TYPE: &str = "technology";

fn row_to_technology(row: &Row) -> rusqlite::Result<Technology> {
    Ok(Technology {
        id: row.get("id")?,
        name: row.get("name")?,
        category: row.get("category")?,
        description: row.get("description")?,
        introduced_date: row.get("introduced_date")?,
        date_precision: row.get("date_precision")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    td.category, td.description, td.introduced_date, td.date_precision
";

pub fn get(conn: &Connection, id: &str) -> Result<Technology> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN technology_details td ON td.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_technology)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("technology {id} not found")))
}

pub fn list(conn: &Connection, filter: &TechnologyFilter) -> Result<Vec<Technology>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN technology_details td ON td.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(category) = filter.category.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("td.category = ?".to_string());
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

    let rows = stmt.query_map(params_refs.as_slice(), row_to_technology)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn create(conn: &Connection, input: NewTechnology) -> Result<Technology> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("technology name is required".into()));
    }

    let category = input.category.unwrap_or_else(|| "other".to_string());
    let date_precision = input.date_precision.unwrap_or_else(|| "day".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Technology> {
        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO technology_details (entity_id, category, description, introduced_date, date_precision)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id,
                category,
                input.description.unwrap_or_default(),
                input.introduced_date,
                date_precision,
            ],
        )?;

        let technology = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&technology),
            None,
        )?;
        Ok(technology)
    })();

    match result {
        Ok(technology) => {
            conn.execute("COMMIT", [])?;
            Ok(technology)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

pub fn update(conn: &Connection, id: &str, patch: TechnologyPatch) -> Result<Technology> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Technology> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("technology name cannot be empty".into()));
            }
            conn.execute(
                "UPDATE entities SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )?;
        } else {
            conn.execute("UPDATE entities SET updated_at = ?1 WHERE id = ?2", params![now, id])?;
        }

        if let Some(category) = &patch.category {
            conn.execute(
                "UPDATE technology_details SET category = ?1 WHERE entity_id = ?2",
                params![category, id],
            )?;
        }
        if let Some(description) = &patch.description {
            conn.execute(
                "UPDATE technology_details SET description = ?1 WHERE entity_id = ?2",
                params![description, id],
            )?;
        }
        if let Some(introduced_date) = &patch.introduced_date {
            conn.execute(
                "UPDATE technology_details SET introduced_date = ?1 WHERE entity_id = ?2",
                params![introduced_date, id],
            )?;
        }
        if let Some(date_precision) = &patch.date_precision {
            conn.execute(
                "UPDATE technology_details SET date_precision = ?1 WHERE entity_id = ?2",
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
        Ok(technology) => {
            conn.execute("COMMIT", [])?;
            Ok(technology)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the technology and cascades any relationships touching it
/// (both `requires` edges -- as dependent or prerequisite -- and
/// `uses_technology` links), without affecting the technologies/
/// characters/events/locations on the other end (FR2.4/FR3.1 cascade
/// contract, identical to every prior phase).
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

/// Returns the ids of `technology_id`'s direct prerequisites -- the
/// technologies it `requires` (this technology is the relationship
/// source). Used both by `list_prerequisites` (public, returns full
/// `Technology` rows) and by `would_create_cycle`'s graph walk (only needs
/// ids, to keep the traversal cheap).
fn list_prerequisite_ids(conn: &Connection, technology_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT target_entity_id FROM relationships
         WHERE source_entity_id = ?1 AND relationship_type = ?2 AND deleted_at IS NULL",
    )?;
    let rows = stmt.query_map(params![technology_id, REQUIRES], |row| row.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// The direct prerequisites of `technology_id` -- what it `requires`
/// (FR2.3).
pub fn list_prerequisites(conn: &Connection, technology_id: &str) -> Result<Vec<Technology>> {
    let ids = list_prerequisite_ids(conn, technology_id)?;
    let mut out = Vec::new();
    for id in ids {
        out.push(get(conn, &id)?);
    }
    Ok(out)
}

/// The direct dependents of `technology_id` -- the technologies that
/// `require` it (FR2.3). This is the reverse direction of
/// `list_prerequisites`: relationships where `technology_id` is the
/// *target*, not the source.
pub fn list_dependents(conn: &Connection, technology_id: &str) -> Result<Vec<Technology>> {
    let mut stmt = conn.prepare(
        "SELECT source_entity_id FROM relationships
         WHERE target_entity_id = ?1 AND relationship_type = ?2 AND deleted_at IS NULL",
    )?;
    let rows = stmt.query_map(params![technology_id, REQUIRES], |row| row.get::<_, String>(0))?;
    let mut out = Vec::new();
    for row in rows {
        let id: String = row?;
        out.push(get(conn, &id)?);
    }
    Ok(out)
}

/// Returns true if adding a `requires` edge from `dependent_id` to
/// `prerequisite_id` would introduce a cycle anywhere in the technology
/// dependency graph (FR2.2). Unlike Phase 4's `would_create_cycle` (a
/// single-parent *chain* walk, since a location has at most one parent), a
/// technology can have multiple prerequisites, so this performs a bounded
/// breadth-first *graph* traversal: starting from the candidate
/// prerequisite, follow every outgoing `requires` edge; if the traversal
/// ever reaches `dependent_id`, the new edge would close a cycle. A
/// `HashSet` of visited ids bounds the walk to the number of technologies
/// that exist, so it terminates even if a cycle somehow already exists in
/// the data (defensive, mirroring Phase 4's same posture).
pub fn would_create_cycle(conn: &Connection, dependent_id: &str, prerequisite_id: &str) -> Result<bool> {
    if dependent_id == prerequisite_id {
        return Ok(true);
    }

    let mut seen: HashSet<String> = HashSet::new();
    let mut frontier = vec![prerequisite_id.to_string()];

    while let Some(current) = frontier.pop() {
        if current == dependent_id {
            return Ok(true);
        }
        if !seen.insert(current.clone()) {
            continue;
        }
        for next in list_prerequisite_ids(conn, &current)? {
            frontier.push(next);
        }
    }

    Ok(false)
}

/// Creates a `requires` edge from `dependent_id` to `prerequisite_id`,
/// rejecting it first if it would introduce a cycle (FR2.2). This is the
/// one place the frontend needs to know "creating this specific kind of
/// edge has extra rules" -- every other relationship type in the app
/// (`participates_in`, `depends_on`, `relates_to`, `located_at`,
/// `uses_technology`) is created directly through the generic
/// `relationships::create`, which stays unaware of technology-specific
/// cycle rules (design-phase-5-technology.md section 2.1).
pub fn create_requires_edge(
    conn: &Connection,
    dependent_id: &str,
    prerequisite_id: &str,
) -> Result<Relationship> {
    if would_create_cycle(conn, dependent_id, prerequisite_id)? {
        return Err(LoreError::InvalidInput(
            "this dependency would create a cycle in the technology tree".into(),
        ));
    }

    relationships::create(
        conn,
        NewRelationship {
            source_entity_id: dependent_id.to_string(),
            target_entity_id: prerequisite_id.to_string(),
            relationship_type: REQUIRES.to_string(),
            label: None,
            strength: None,
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::models::{NewCharacter, NewRelationship, USES_TECHNOLOGY};

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewTechnology {
                name: "Void Drive".into(),
                category: Some("void_technology".into()),
                description: Some("Faster-than-light propulsion using void energy.".into()),
                introduced_date: Some("2130-01-01".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Void Drive");
        assert_eq!(created.category, "void_technology");
        assert_eq!(created.introduced_date, Some("2130-01-01".to_string()));

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.description, "Faster-than-light propulsion using void energy.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewTechnology::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_only_touches_provided_fields() {
        let conn = setup();
        let created = create(
            &conn,
            NewTechnology {
                name: "Void Theory".into(),
                description: Some("The physics underpinning void energy.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        let updated =
            update(&conn, &created.id, TechnologyPatch { category: Some("void_technology".into()), ..Default::default() })
                .unwrap();

        assert_eq!(updated.category, "void_technology");
        assert_eq!(updated.description, "The physics underpinning void energy.");
        assert_eq!(updated.name, "Void Theory");
    }

    #[test]
    fn update_can_clear_introduced_date_via_explicit_null() {
        let conn = setup();
        let created = create(
            &conn,
            NewTechnology { name: "Mystery Tech".into(), introduced_date: Some("2100-01-01".into()), ..Default::default() },
        )
        .unwrap();
        assert_eq!(created.introduced_date, Some("2100-01-01".to_string()));

        let cleared =
            update(&conn, &created.id, TechnologyPatch { introduced_date: Some(None), ..Default::default() }).unwrap();
        assert_eq!(cleared.introduced_date, None);
    }

    #[test]
    fn list_filters_by_category() {
        let conn = setup();
        create(&conn, NewTechnology { name: "Void Drive".into(), category: Some("void_technology".into()), ..Default::default() }).unwrap();
        create(&conn, NewTechnology { name: "Plasma Rifle".into(), category: Some("weapons".into()), ..Default::default() }).unwrap();
        create(&conn, NewTechnology { name: "Rail Gun".into(), category: Some("weapons".into()), ..Default::default() }).unwrap();

        let weapons = list(&conn, &TechnologyFilter { category: Some("weapons".into()), ..Default::default() }).unwrap();
        assert_eq!(weapons.len(), 2);
    }

    #[test]
    fn delete_is_soft_and_hides_from_list() {
        let conn = setup();
        let created = create(&conn, NewTechnology { name: "Temp Tech".into(), ..Default::default() }).unwrap();

        delete(&conn, &created.id).unwrap();

        let err = get(&conn, &created.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));

        let all = list(&conn, &TechnologyFilter::default()).unwrap();
        assert!(all.iter().all(|t| t.id != created.id));
    }

    #[test]
    fn create_requires_edge_populates_prerequisites_and_dependents_symmetrically() {
        let conn = setup();
        let void_theory = create(&conn, NewTechnology { name: "Void Theory".into(), ..Default::default() }).unwrap();
        let void_drive = create(&conn, NewTechnology { name: "Void Drive".into(), ..Default::default() }).unwrap();

        create_requires_edge(&conn, &void_drive.id, &void_theory.id).unwrap();

        let prereqs = list_prerequisites(&conn, &void_drive.id).unwrap();
        assert_eq!(prereqs.len(), 1);
        assert_eq!(prereqs[0].name, "Void Theory");

        let dependents = list_dependents(&conn, &void_theory.id).unwrap();
        assert_eq!(dependents.len(), 1);
        assert_eq!(dependents[0].name, "Void Drive");
    }

    #[test]
    fn create_requires_edge_rejects_a_direct_cycle() {
        let conn = setup();
        let void_theory = create(&conn, NewTechnology { name: "Void Theory".into(), ..Default::default() }).unwrap();
        let void_drive = create(&conn, NewTechnology { name: "Void Drive".into(), ..Default::default() }).unwrap();

        create_requires_edge(&conn, &void_drive.id, &void_theory.id).unwrap();

        // Void Theory already underlies Void Drive; making Void Theory
        // require Void Drive would close a direct 2-node cycle (AC3).
        let err = create_requires_edge(&conn, &void_theory.id, &void_drive.id).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_requires_edge_rejects_an_indirect_transitive_cycle() {
        let conn = setup();
        let a = create(&conn, NewTechnology { name: "A".into(), ..Default::default() }).unwrap();
        let b = create(&conn, NewTechnology { name: "B".into(), ..Default::default() }).unwrap();
        let c = create(&conn, NewTechnology { name: "C".into(), ..Default::default() }).unwrap();

        // A requires B, B requires C.
        create_requires_edge(&conn, &a.id, &b.id).unwrap();
        create_requires_edge(&conn, &b.id, &c.id).unwrap();

        // C requires A would close the cycle A -> B -> C -> A (AC4).
        let err = create_requires_edge(&conn, &c.id, &a.id).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_requires_edge_accepts_multiple_unrelated_prerequisites() {
        let conn = setup();
        let power_system = create(&conn, NewTechnology { name: "Fusion Core".into(), ..Default::default() }).unwrap();
        let targeting_ai = create(&conn, NewTechnology { name: "Targeting AI".into(), ..Default::default() }).unwrap();
        let weapon = create(&conn, NewTechnology { name: "Plasma Cannon".into(), ..Default::default() }).unwrap();

        create_requires_edge(&conn, &weapon.id, &power_system.id).unwrap();
        create_requires_edge(&conn, &weapon.id, &targeting_ai.id).unwrap();

        let prereqs = list_prerequisites(&conn, &weapon.id).unwrap();
        assert_eq!(prereqs.len(), 2);
    }

    #[test]
    fn technology_can_be_used_by_a_character_via_relationships_table() {
        let conn = setup();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let technology = create(&conn, NewTechnology { name: "Void Drive".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: technology.id.clone(),
                relationship_type: USES_TECHNOLOGY.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &technology.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, USES_TECHNOLOGY);
        assert_eq!(links[0].source_entity_id, character.id);
    }

    #[test]
    fn deleting_a_technology_cascades_requires_and_uses_without_touching_other_side() {
        let conn = setup();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let void_theory = create(&conn, NewTechnology { name: "Void Theory".into(), ..Default::default() }).unwrap();
        let void_drive = create(&conn, NewTechnology { name: "Void Drive".into(), ..Default::default() }).unwrap();

        create_requires_edge(&conn, &void_drive.id, &void_theory.id).unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: void_drive.id.clone(),
                relationship_type: USES_TECHNOLOGY.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        delete(&conn, &void_drive.id).unwrap();

        assert!(list_prerequisites(&conn, &void_drive.id).is_err() || list_prerequisites(&conn, &void_drive.id).unwrap().is_empty());
        assert!(list_dependents(&conn, &void_theory.id).unwrap().is_empty());
        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(get(&conn, &void_theory.id).is_ok(), "prerequisite technology must survive dependent's deletion");
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive technology deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewTechnology { name: "Revised Tech".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, TechnologyPatch { description: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete");
        assert_eq!(history[2].action, "create");
    }
}
