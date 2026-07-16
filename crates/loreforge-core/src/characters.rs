use crate::error::{LoreError, Result};
use crate::models::{Character, CharacterFilter, CharacterPatch, NewCharacter};
use crate::revisions::{self, Action, RecordType};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

const ENTITY_TYPE: &str = "character";

fn row_to_character(row: &Row) -> rusqlite::Result<Character> {
    let tags_json: String = row.get("tags_json")?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

    Ok(Character {
        id: row.get("id")?,
        name: row.get("name")?,
        role: row.get("role")?,
        status: row.get("status")?,
        biography: row.get("biography")?,
        appearance: row.get("appearance")?,
        goals: row.get("goals")?,
        needs: row.get("needs")?,
        flaws: row.get("flaws")?,
        secrets: row.get("secrets")?,
        psychology: row.get("psychology")?,
        dialogue_style: row.get("dialogue_style")?,
        tags,
        needs_development: row.get::<_, i64>("needs_development")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_COLUMNS: &str = "
    e.id, e.name, e.created_at, e.updated_at,
    cd.role, cd.status, cd.biography, cd.appearance, cd.goals, cd.needs,
    cd.flaws, cd.secrets, cd.psychology, cd.dialogue_style, cd.tags_json,
    cd.needs_development
";

pub fn create(conn: &Connection, input: NewCharacter) -> Result<Character> {
    if input.name.trim().is_empty() {
        return Err(LoreError::InvalidInput("character name is required".into()));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let role = input.role.unwrap_or_else(|| "supporting".to_string());
    let status = input.status.unwrap_or_else(|| "alive".to_string());
    let tags_json = serde_json::to_string(&input.tags.unwrap_or_default())?;

    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Character> {
        conn.execute(
            "INSERT INTO entities (id, entity_type, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
            params![id, ENTITY_TYPE, input.name, now],
        )?;

        conn.execute(
            "INSERT INTO character_details (
                entity_id, role, status, biography, appearance, goals, needs,
                flaws, secrets, psychology, dialogue_style, tags_json, needs_development
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0)",
            params![
                id,
                role,
                status,
                input.biography.unwrap_or_default(),
                input.appearance.unwrap_or_default(),
                input.goals.unwrap_or_default(),
                input.needs.unwrap_or_default(),
                input.flaws.unwrap_or_default(),
                input.secrets.unwrap_or_default(),
                input.psychology.unwrap_or_default(),
                input.dialogue_style.unwrap_or_default(),
                tags_json,
            ],
        )?;

        let character = get(conn, &id)?;
        revisions::record(
            conn,
            RecordType::Entity,
            Action::Create,
            &id,
            None::<&()>,
            Some(&character),
            None,
        )?;
        Ok(character)
    })();

    match result {
        Ok(character) => {
            conn.execute("COMMIT", [])?;
            Ok(character)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

pub fn get(conn: &Connection, id: &str) -> Result<Character> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN character_details cd ON cd.entity_id = e.id
         WHERE e.id = ?1 AND e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    conn.query_row(&sql, params![id], row_to_character)
        .optional()?
        .ok_or_else(|| LoreError::NotFound(format!("character {id} not found")))
}

pub fn list(conn: &Connection, filter: &CharacterFilter) -> Result<Vec<Character>> {
    let mut sql = format!(
        "SELECT {SELECT_COLUMNS} FROM entities e
         JOIN character_details cd ON cd.entity_id = e.id
         WHERE e.entity_type = '{ENTITY_TYPE}' AND e.deleted_at IS NULL"
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = filter.search.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("e.name LIKE ?".to_string());
        bind_values.push(format!("%{}%", search.trim()));
    }
    if let Some(role) = filter.role.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("cd.role = ?".to_string());
        bind_values.push(role.clone());
    }
    if let Some(status) = filter.status.as_ref().filter(|s| !s.trim().is_empty()) {
        conditions.push("cd.status = ?".to_string());
        bind_values.push(status.clone());
    }

    for cond in &conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }
    sql.push_str(" ORDER BY e.name COLLATE NOCASE ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> =
        bind_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params_refs.as_slice(), row_to_character)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: &str, patch: CharacterPatch) -> Result<Character> {
    conn.execute("BEGIN IMMEDIATE", [])?;

    let result = (|| -> Result<Character> {
        let before = get(conn, id)?;
        let now = Utc::now().to_rfc3339();

        if let Some(name) = &patch.name {
            if name.trim().is_empty() {
                return Err(LoreError::InvalidInput("character name cannot be empty".into()));
            }
            conn.execute(
                "UPDATE entities SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )?;
        } else {
            conn.execute("UPDATE entities SET updated_at = ?1 WHERE id = ?2", params![now, id])?;
        }

        macro_rules! update_field {
            ($field:ident, $col:literal) => {
                if let Some(value) = &patch.$field {
                    conn.execute(
                        concat!("UPDATE character_details SET ", $col, " = ?1 WHERE entity_id = ?2"),
                        params![value, id],
                    )?;
                }
            };
        }

        update_field!(role, "role");
        update_field!(status, "status");
        update_field!(biography, "biography");
        update_field!(appearance, "appearance");
        update_field!(goals, "goals");
        update_field!(needs, "needs");
        update_field!(flaws, "flaws");
        update_field!(secrets, "secrets");
        update_field!(psychology, "psychology");
        update_field!(dialogue_style, "dialogue_style");

        if let Some(tags) = &patch.tags {
            let tags_json = serde_json::to_string(tags)?;
            conn.execute(
                "UPDATE character_details SET tags_json = ?1 WHERE entity_id = ?2",
                params![tags_json, id],
            )?;
        }

        if let Some(needs_dev) = patch.needs_development {
            conn.execute(
                "UPDATE character_details SET needs_development = ?1 WHERE entity_id = ?2",
                params![needs_dev as i64, id],
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
        Ok(character) => {
            conn.execute("COMMIT", [])?;
            Ok(character)
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
    use crate::db;
    use crate::models::CharacterPatch;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    #[test]
    fn create_and_get_roundtrip() {
        let conn = setup();
        let created = create(
            &conn,
            NewCharacter {
                name: "Ada Voss".into(),
                role: Some("main".into()),
                biography: Some("A void-tech engineer.".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(created.name, "Ada Voss");
        assert_eq!(created.role, "main");

        let fetched = get(&conn, &created.id).unwrap();
        assert_eq!(fetched.biography, "A void-tech engineer.");
    }

    #[test]
    fn create_rejects_empty_name() {
        let conn = setup();
        let err = create(&conn, NewCharacter::default()).unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn update_only_touches_provided_fields() {
        let conn = setup();
        let created = create(
            &conn,
            NewCharacter {
                name: "Kestrel".into(),
                goals: Some("Find the Resolute".into()),
                ..Default::default()
            },
        )
        .unwrap();

        let updated = update(
            &conn,
            &created.id,
            CharacterPatch {
                secrets: Some("Actually the antagonist".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(updated.secrets, "Actually the antagonist");
        // Untouched field survives the partial update.
        assert_eq!(updated.goals, "Find the Resolute");
        assert_eq!(updated.name, "Kestrel");
    }

    #[test]
    fn delete_is_soft_and_hides_from_list() {
        let conn = setup();
        let created = create(
            &conn,
            NewCharacter { name: "Temp".into(), ..Default::default() },
        )
        .unwrap();

        delete(&conn, &created.id).unwrap();

        let err = get(&conn, &created.id).unwrap_err();
        assert!(matches!(err, LoreError::NotFound(_)));

        let all = list(&conn, &CharacterFilter::default()).unwrap();
        assert!(all.iter().all(|c| c.id != created.id));
    }

    #[test]
    fn list_filters_by_search_role_status() {
        let conn = setup();
        create(&conn, NewCharacter { name: "Ada Voss".into(), role: Some("main".into()), ..Default::default() }).unwrap();
        create(&conn, NewCharacter { name: "Bram Solt".into(), role: Some("supporting".into()), ..Default::default() }).unwrap();
        create(&conn, NewCharacter { name: "Ada Kestrel".into(), role: Some("supporting".into()), status: Some("dead".into()), ..Default::default() }).unwrap();

        let by_search = list(&conn, &CharacterFilter { search: Some("Ada".into()), ..Default::default() }).unwrap();
        assert_eq!(by_search.len(), 2);

        let by_role = list(&conn, &CharacterFilter { role: Some("main".into()), ..Default::default() }).unwrap();
        assert_eq!(by_role.len(), 1);
        assert_eq!(by_role[0].name, "Ada Voss");

        let by_status = list(&conn, &CharacterFilter { status: Some("dead".into()), ..Default::default() }).unwrap();
        assert_eq!(by_status.len(), 1);
        assert_eq!(by_status[0].name, "Ada Kestrel");
    }

    #[test]
    fn revisions_are_recorded_for_create_update_delete() {
        let conn = setup();
        let created = create(&conn, NewCharacter { name: "Revised".into(), ..Default::default() }).unwrap();
        update(&conn, &created.id, CharacterPatch { biography: Some("v2".into()), ..Default::default() }).unwrap();
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
