use crate::error::{LoreError, Result};
use crate::hierarchy;
use crate::models::{
    NewOrganization, Organization, OrganizationFilter, OrganizationPatch, Relationship,
    ORG_ALLIED_WITH, ORG_RIVAL_OF,
};
use crate::revisions::{self, Action, RecordType};
use crate::symmetric;
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "organization";

fn row_to_organization(row: &Row) -> rusqlite::Result<Organization> {
    Ok(Organization {
        id: row.get("id")?,
        name: row.get("name")?,
        classification: row.get("classification")?,
        charter: row.get("charter")?,
        parent_organization_id: row.get("parent_organization_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    od.classification, od.charter, od.parent_organization_id
";

pub fn get(conn: &Connection, id: &str) -> Result<Organization> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN organization_details od ON od.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_organization)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("organization {id} not found")))
}

/// Lists the direct subsidiaries of `parent_id`, or root-level
/// organizations (`parent_organization_id IS NULL`) when `parent_id` is
/// `None` (FR3.1). Subsidiary structure is a strict tree, same structural
/// role as every prior hierarchical entity type, so the query shape is
/// identical to `religions::list_schisms` et al.
pub fn list_subsidiaries(conn: &Connection, parent_id: Option<&str>) -> Result<Vec<Organization>> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN organization_details od ON od.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL
         AND od.parent_organization_id {} ORDER BY e.name COLLATE NOCASE ASC",
        if parent_id.is_some() { "= ?1" } else { "IS NULL" }
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = if let Some(pid) = parent_id {
        stmt.query_map(params![pid], row_to_organization)?
    } else {
        stmt.query_map([], row_to_organization)?
    };
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list(conn: &Connection, filter: &OrganizationFilter) -> Result<Vec<Organization>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN organization_details od ON od.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(classification) = filter.classification.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("od.classification = ?".to_string());
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

    let rows = stmt.query_map(params_refs.as_slice(), row_to_organization)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Returns true if setting `candidate_id`'s parent to `new_parent_id`
/// would make `candidate_id` its own ancestor (FR2.3/FR3.5). Delegates to
/// the shared single-parent-tree chain-walk in `hierarchy.rs` -- the
/// fifth consumer, following `religions.rs`'s precedent of using the
/// shared helper from day one.
pub fn would_create_cycle(conn: &Connection, candidate_id: &str, new_parent_id: &str) -> Result<bool> {
    Ok(hierarchy::would_create_cycle(candidate_id, new_parent_id, |id| {
        get(conn, id).ok().and_then(|o| o.parent_organization_id)
    }))
}

pub fn create(conn: &Connection, input: NewOrganization) -> Result<Organization> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("organization name is required".into()));
    }

    let classification = input.classification.unwrap_or_else(|| "other".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Organization> {
        if let Some(parent_id) = &input.parent_organization_id {
            get(conn, parent_id)
                .map_err(|_| LoreError::InvalidInput(format!("parent organization {parent_id} not found")))?;
        }

        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO organization_details (entity_id, classification, charter, parent_organization_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                id,
                classification,
                input.charter.unwrap_or_default(),
                input.parent_organization_id,
            ],
        )?;

        let organization = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&organization),
            None,
        )?;
        Ok(organization)
    })();

    match result {
        Ok(organization) => {
            conn.execute("COMMIT", [])?;
            Ok(organization)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Updates an organization. Reparenting is validated against cycles
/// (FR3.5) before any write happens, in the same transaction as the rest
/// of the update (NFR2).
pub fn update(conn: &Connection, id: &str, patch: OrganizationPatch) -> Result<Organization> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Organization> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(new_parent) = &patch.parent_organization_id {
            if let Some(new_parent_id) = new_parent {
                get(conn, new_parent_id)
                    .map_err(|_| LoreError::InvalidInput(format!("parent organization {new_parent_id} not found")))?;
                if would_create_cycle(conn, id, new_parent_id)? {
                    return Err(LoreError::InvalidInput(
                        "cannot set an organization's parent to itself or one of its own subsidiaries".into(),
                    ));
                }
            }
        }

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("organization name cannot be empty".into()));
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
                "UPDATE organization_details SET classification = ?1 WHERE entity_id = ?2",
                params![classification, id],
            )?;
        }
        if let Some(charter) = &patch.charter {
            conn.execute(
                "UPDATE organization_details SET charter = ?1 WHERE entity_id = ?2",
                params![charter, id],
            )?;
        }
        if let Some(new_parent) = &patch.parent_organization_id {
            conn.execute(
                "UPDATE organization_details SET parent_organization_id = ?1 WHERE entity_id = ?2",
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
        Ok(organization) => {
            conn.execute("COMMIT", [])?;
            Ok(organization)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Soft-deletes the organization, reparenting its direct subsidiaries to
/// its own parent (or to root, if it had none) so the subtree survives
/// one level shallower rather than being orphaned or cascade-deleted
/// (FR3.3), and cascades any relationships touching it
/// (`affiliated_with`, `operates_at`, `org_allied_with`, `org_rival_of`)
/// without affecting the characters/locations/other organizations on the
/// other end (FR3.4).
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<()> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE organization_details SET parent_organization_id = ?1 WHERE parent_organization_id = ?2",
            params![before.parent_organization_id, id],
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

/// Creates a symmetric edge (`ORG_ALLIED_WITH` or `ORG_RIVAL_OF`) between
/// two organizations `a` and `b`. Delegates to the shared
/// `symmetric::create_symmetric_edge` -- Organizations is the second
/// consumer of this helper (after Politics), and the first to consume it
/// from day one rather than starting with its own copy
/// (design-phase-10-organizations.md section 1).
pub fn create_symmetric_edge(
    conn: &Connection,
    a: &str,
    b: &str,
    relationship_type: &str,
) -> Result<Relationship> {
    if relationship_type != ORG_ALLIED_WITH && relationship_type != ORG_RIVAL_OF {
        return Err(LoreError::InvalidInput(format!(
            "unsupported symmetric relationship type '{relationship_type}'"
        )));
    }
    let opposite = if relationship_type == ORG_ALLIED_WITH { ORG_RIVAL_OF } else { ORG_ALLIED_WITH };
    symmetric::create_symmetric_edge(conn, a, b, relationship_type, opposite)
}

/// The organizations allied with `entity_id`, resolved regardless of
/// which side of the underlying relationship row `entity_id` happens to
/// be on.
pub fn list_org_allies(conn: &Connection, entity_id: &str) -> Result<Vec<Organization>> {
    symmetric::list_symmetric_link_ids(conn, entity_id, ORG_ALLIED_WITH)?
        .into_iter()
        .map(|id| get(conn, &id))
        .collect()
}

/// The organizations that are rivals of `entity_id`. See
/// `list_org_allies`.
pub fn list_org_rivals(conn: &Connection, entity_id: &str) -> Result<Vec<Organization>> {
    symmetric::list_symmetric_link_ids(conn, entity_id, ORG_RIVAL_OF)?
        .into_iter()
        .map(|id| get(conn, &id))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::locations;
    use crate::models::{NewCharacter, NewLocation, NewRelationship, AFFILIATED_WITH, OPERATES_AT};
    use crate::relationships;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewOrganization {
                name: "Ashenford Trading Guild".into(),
                classification: Some("guild".into()),
                charter: Some("Regulate river trade and protect member caravans.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Ashenford Trading Guild");
        assert_eq!(created.classification, "guild");
        assert_eq!(created.parent_organization_id, None);

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.charter, "Regulate river trade and protect member caravans.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewOrganization::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_nonexistent_parent() {
        let conn = setup();
        let err = create(
            &conn,
            NewOrganization {
                name: "Orphan Org".into(),
                parent_organization_id: Some("does-not-exist".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn list_subsidiaries_returns_direct_children_including_root() {
        let conn = setup();
        let guild = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let chapter = create(
            &conn,
            NewOrganization { name: "Riverside Chapter".into(), parent_organization_id: Some(guild.id.clone()), ..Default::default() },
        )
        .unwrap();
        create(
            &conn,
            NewOrganization { name: "Highland Chapter".into(), parent_organization_id: Some(guild.id.clone()), ..Default::default() },
        )
        .unwrap();

        let root_level = list_subsidiaries(&conn, None).unwrap();
        assert_eq!(root_level.len(), 1);
        assert_eq!(root_level[0].name, "Ashenford Trading Guild");

        let guild_children = list_subsidiaries(&conn, Some(&guild.id)).unwrap();
        assert_eq!(guild_children.len(), 2);

        let chapter_children = list_subsidiaries(&conn, Some(&chapter.id)).unwrap();
        assert!(chapter_children.is_empty());
    }

    #[test]
    fn setting_an_organizations_parent_to_its_own_descendant_is_rejected() {
        let conn = setup();
        let guild = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let chapter = create(
            &conn,
            NewOrganization { name: "Riverside Chapter".into(), parent_organization_id: Some(guild.id.clone()), ..Default::default() },
        )
        .unwrap();

        let err = update(
            &conn,
            &guild.id,
            OrganizationPatch { parent_organization_id: Some(Some(chapter.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));

        let err2 = update(
            &conn,
            &chapter.id,
            OrganizationPatch { parent_organization_id: Some(Some(chapter.id.clone())), ..Default::default() },
        )
        .unwrap_err();
        assert!(matches!(err2, LoreError::InvalidInput(_)));
    }

    #[test]
    fn deleting_an_organization_reparents_its_subsidiaries_up_one_level() {
        let conn = setup();
        let guild = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let chapter = create(
            &conn,
            NewOrganization { name: "Riverside Chapter".into(), parent_organization_id: Some(guild.id.clone()), ..Default::default() },
        )
        .unwrap();

        delete(&conn, &guild.id).unwrap();

        let survived = get(&conn, &chapter.id).unwrap();
        assert_eq!(survived.parent_organization_id, None);

        let err = get(&conn, &guild.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));
    }

    #[test]
    fn list_filters_by_classification() {
        let conn = setup();
        create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), classification: Some("guild".into()), ..Default::default() }).unwrap();
        create(&conn, NewOrganization { name: "Void Runners".into(), classification: Some("syndicate".into()), ..Default::default() }).unwrap();

        let syndicates = list(&conn, &OrganizationFilter { classification: Some("syndicate".into()), ..Default::default() }).unwrap();
        assert_eq!(syndicates.len(), 1);
        assert_eq!(syndicates[0].name, "Void Runners");
    }

    #[test]
    fn character_can_be_affiliated_with_an_organization_via_relationships_table() {
        let conn = setup();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let org = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: org.id.clone(),
                relationship_type: AFFILIATED_WITH.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &org.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, AFFILIATED_WITH);
        assert_eq!(links[0].source_entity_id, character.id);
    }

    #[test]
    fn organization_can_operate_at_a_location_via_relationships_table() {
        let conn = setup();
        let org = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let location = locations::create(&conn, NewLocation { name: "Ashenford Docks".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: org.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: OPERATES_AT.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        let links = relationships::list_for_entity(&conn, &location.id).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relationship_type, OPERATES_AT);
        assert_eq!(links[0].source_entity_id, org.id);
    }

    #[test]
    fn create_symmetric_edge_resolves_allies_regardless_of_initiating_direction() {
        let conn = setup();
        let guild = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let runners = create(&conn, NewOrganization { name: "Void Runners".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &guild.id, &runners.id, ORG_ALLIED_WITH).unwrap();

        let guild_allies = list_org_allies(&conn, &guild.id).unwrap();
        assert_eq!(guild_allies.len(), 1);
        assert_eq!(guild_allies[0].id, runners.id);

        let runners_allies = list_org_allies(&conn, &runners.id).unwrap();
        assert_eq!(runners_allies.len(), 1);
        assert_eq!(runners_allies[0].id, guild.id);
    }

    #[test]
    fn create_symmetric_edge_rejects_a_duplicate_in_the_reverse_direction() {
        let conn = setup();
        let guild = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let runners = create(&conn, NewOrganization { name: "Void Runners".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &guild.id, &runners.id, ORG_ALLIED_WITH).unwrap();
        let err = create_symmetric_edge(&conn, &runners.id, &guild.id, ORG_ALLIED_WITH).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));

        assert_eq!(list_org_allies(&conn, &guild.id).unwrap().len(), 1);
    }

    #[test]
    fn create_symmetric_edge_rejects_org_rival_of_when_org_allied_with_already_exists_and_vice_versa() {
        let conn = setup();
        let guild = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let runners = create(&conn, NewOrganization { name: "Void Runners".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &guild.id, &runners.id, ORG_ALLIED_WITH).unwrap();
        let err = create_symmetric_edge(&conn, &runners.id, &guild.id, ORG_RIVAL_OF).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
        assert!(list_org_rivals(&conn, &guild.id).unwrap().is_empty());

        let cartel = create(&conn, NewOrganization { name: "Ember Cartel".into(), ..Default::default() }).unwrap();
        create_symmetric_edge(&conn, &guild.id, &cartel.id, ORG_RIVAL_OF).unwrap();
        let err2 = create_symmetric_edge(&conn, &cartel.id, &guild.id, ORG_ALLIED_WITH).unwrap_err();
        assert!(matches!(err2, LoreError::InvalidInput(_)));
    }

    #[test]
    fn deleting_an_organization_cascades_all_relationship_types_without_touching_other_side() {
        let conn = setup();
        let character = characters::create(&conn, NewCharacter { name: "Ada Voss".into(), ..Default::default() }).unwrap();
        let location = locations::create(&conn, NewLocation { name: "Ashenford Docks".into(), ..Default::default() }).unwrap();
        let guild = create(&conn, NewOrganization { name: "Ashenford Trading Guild".into(), ..Default::default() }).unwrap();
        let runners = create(&conn, NewOrganization { name: "Void Runners".into(), ..Default::default() }).unwrap();

        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: character.id.clone(),
                target_entity_id: guild.id.clone(),
                relationship_type: AFFILIATED_WITH.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        relationships::create(
            &conn,
            NewRelationship {
                source_entity_id: guild.id.clone(),
                target_entity_id: location.id.clone(),
                relationship_type: OPERATES_AT.to_string(),
                label: None,
                strength: None,
            },
        )
        .unwrap();
        create_symmetric_edge(&conn, &guild.id, &runners.id, ORG_ALLIED_WITH).unwrap();

        delete(&conn, &guild.id).unwrap();

        assert!(relationships::list_for_entity(&conn, &character.id).unwrap().is_empty());
        assert!(relationships::list_for_entity(&conn, &location.id).unwrap().is_empty());
        assert!(list_org_allies(&conn, &runners.id).unwrap().is_empty());
        assert!(characters::get(&conn, &character.id).is_ok(), "character must survive organization deletion");
        assert!(locations::get(&conn, &location.id).is_ok(), "location must survive organization deletion");
        assert!(get(&conn, &runners.id).is_ok(), "other organization must survive deletion");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewOrganization { name: "Revised Org".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, OrganizationPatch { charter: Some("v2".into()), ..Default::default() }).unwrap();
        delete(&conn, &created.id).unwrap();

        let history = revisions::list_for_record(&conn, &created.id, 100).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].action, "delete");
        assert_eq!(history[2].action, "create");
    }
}
