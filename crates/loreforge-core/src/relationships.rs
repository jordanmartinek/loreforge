use crate::error::{LoreError, Result};
use crate::models::{NewRelationship, Relationship, RelationshipPatch};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

fn row_to_relationship(row: &Row) -> rusqlite::Result<Relationship> {
    Ok(Relationship {
        id: row.get("id")?,
        source_entity_id: row.get("source_entity_id")?,
        target_entity_id: row.get("target_entity_id")?,
        relationship_type: row.get("relationship_type")?,
        label: row.get("label")?,
        strength: row.get("strength")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_SQL: &str = "SELECT id, source_entity_id, target_entity_id, relationship_type, label, strength, created_at, updated_at
     FROM relationships WHERE deleted_at IS NULL";

pub fn create(conn: &Connection, input: NewRelationship) -> Result<Relationship> {
    if input.source_entity_id == input.target_entity_id {
        return Err(LoreError::InvalidInput(
            "a relationship cannot connect an entity to itself".into(),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let strength = input.strength.unwrap_or(0.5).clamp(0.0, 1.0);

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Relationship> {
        // Ensure both endpoints exist and are not soft-deleted.
        for entity_id in [&input.source_entity_id, &input.target_entity_id] {
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM entities WHERE id = ?1 AND deleted_at IS NULL)",
                    params![entity_id],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if !exists {
                return Err(LoreError::NotFound(format!("entity {entity_id} not found")));
            }
        }

        conn.execute(
            "INSERT INTO relationships (id, source_entity_id, target_entity_id, relationship_type, label, strength, attributes_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, '{}', ?7, ?7)",
            params![
                id,
                input.source_entity_id,
                input.target_entity_id,
                input.relationship_type,
                input.label,
                strength,
                now,
            ],
        )?;

        let relationship = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Relationship,
            Action::Create,
            &id,
            None::<&()>,
            Some(&relationship),
            None,
        )?;
        Ok(relationship)
    })();

    match result {
        Ok(r) => {
            conn.execute("COMMIT", [])?;
            Ok(r)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

pub fn get(conn: &Connection, id: &str) -> Result<Relationship> {
    let sql = format!("{SELECT_SQL} AND id = ?1");
    conn.query_row(&sql, params![id], row_to_relationship)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("relationship {id} not found")))
}

pub fn list_all(conn: &Connection) -> Result<Vec<Relationship>> {
    let mut stmt = conn.prepare(SELECT_SQL)?;
    let rows = stmt.query_map([], row_to_relationship)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn list_for_entity(conn: &Connection, entity_id: &str) -> Result<Vec<Relationship>> {
    let sql = format!("{SELECT_SQL} AND (source_entity_id = ?1 OR target_entity_id = ?1)");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![entity_id], row_to_relationship)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: &str, patch: RelationshipPatch) -> Result<Relationship> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Relationship> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(rel_type) = &patch.relationship_type {
            conn.execute(
                "UPDATE relationships SET relationship_type = ?1, updated_at = ?2 WHERE id = ?3",
                params![rel_type, now, id],
            )?;
        }
        if let Some(label) = &patch.label {
            conn.execute(
                "UPDATE relationships SET label = ?1, updated_at = ?2 WHERE id = ?3",
                params![label, now, id],
            )?;
        }
        if let Some(strength) = patch.strength {
            conn.execute(
                "UPDATE relationships SET strength = ?1, updated_at = ?2 WHERE id = ?3",
                params![strength.clamp(0.0, 1.0), now, id],
            )?;
        }

        let after = get(conn, id)?;
        revisions::record(
            conn,
            RecordType::Relationship,
            Action::Update,
            id,
            Some(&before),
            Some(&after),
            None,
        )?;
        Ok(after)
    })();

    match result {
        Ok(r) => {
            conn.execute("COMMIT", [])?;
            Ok(r)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<()> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE relationships SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;

        revisions::record(
            conn,
            RecordType::Relationship,
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
    use crate::models::NewCharacter;

    fn setup_with_two_characters() -> (Connection, String, String) {
        let conn = db::open_in_memory().unwrap();
        let a = characters::create(&conn, NewCharacter { name: "Ada".into(), ..Default::default() }).unwrap();
        let b = characters::create(&conn, NewCharacter { name: "Bram".into(), ..Default::default() }).unwrap();
        (conn, a.id, b.id)
    }

    #[test]
    fn create_relationship_and_fetch_for_entity() {
        let (conn, a, b) = setup_with_two_characters();
        let rel = create(
            &conn,
            NewRelationship {
                source_entity_id: a.clone(),
                target_entity_id: b.clone(),
                relationship_type: "mentor".into(),
                label: None,
                strength: Some(0.8),
            },
        )
        .unwrap();

        assert_eq!(rel.relationship_type, "mentor");

        let for_a = list_for_entity(&conn, &a).unwrap();
        let for_b = list_for_entity(&conn, &b).unwrap();
        assert_eq!(for_a.len(), 1);
        assert_eq!(for_b.len(), 1);
        assert_eq!(for_a[0].id, for_b[0].id);
    }

    #[test]
    fn rejects_self_relationship() {
        let (conn, a, _b) = setup_with_two_characters();
        let err = create(
            &conn,
            NewRelationship {
                source_entity_id: a.clone(),
                target_entity_id: a,
                relationship_type: "friend".into(),
                label: None,
                strength: None,
            },
        )
        .unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn deleting_character_soft_deletes_its_relationships() {
        let (conn, a, b) = setup_with_two_characters();
        create(
            &conn,
            NewRelationship {
                source_entity_id: a.clone(),
                target_entity_id: b.clone(),
                relationship_type: "friend".into(),
                label: None,
                strength: None,
            },
        )
        .unwrap();

        characters::delete(&conn, &a).unwrap();

        let remaining = list_all(&conn).unwrap();
        assert!(remaining.is_empty(), "relationships touching a deleted entity should be hidden");
    }
}
