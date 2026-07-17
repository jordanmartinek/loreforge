use crate::error::{LoreError, Result};
use crate::models::{NewRelationship, Relationship};
use crate::relationships;
use rusqlite::{params, Connection, OptionalExtension};

/// Generic symmetric-relationship support, shared by every pair of
/// mutually-exclusive relationship types between two entities of the
/// SAME entity type (Politics' `allied_with`/`rival_of` -- Phase 8 --
/// and now Organizations' `org_allied_with`/`org_rival_of` -- Phase 10).
///
/// Extracted after only its SECOND use, unlike `hierarchy.rs` (extracted
/// after its fourth). That's not a contradiction: `hierarchy.rs`'s
/// chain-walk had to be independently reimplemented three times before
/// there was confidence no entity-type-specific variation existed.
/// Politics' `create_symmetric_edge`/`list_allies`/`list_rivals` were
/// already written to be generic over the *relationship type itself*
/// (taking `ALLIED_WITH` vs. `RIVAL_OF` as a runtime parameter, not one
/// function per type) -- the only entity-type-specific things left were
/// which two relationship-type strings to use and which table to resolve
/// full records from, both of which are trivial parameters to add. See
/// design-phase-10-organizations.md section 1.2 for the full reasoning.
///
/// This module resolves ids only, not full records -- it has no
/// knowledge of any specific entity type's table, so callers
/// (`politics::list_allies`, `organizations::list_allies`, etc.) resolve
/// full records themselves via their own `get()`.
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

/// Creates a symmetric edge of `relationship_type` between `a` and `b`.
/// Validates, in order, before any write happens:
///   1. No self-link.
///   2. No existing edge of `relationship_type` already exists between
///      this pair, in either direction (no duplicates).
///   3. No existing edge of `opposite_type` exists between this pair, in
///      either direction (the two types are mutually exclusive with each
///      other -- e.g. a pair can't be both allied and rivals).
pub fn create_symmetric_edge(
    conn: &Connection,
    a: &str,
    b: &str,
    relationship_type: &str,
    opposite_type: &str,
) -> Result<Relationship> {
    if a == b {
        return Err(LoreError::InvalidInput(format!(
            "an entity cannot be its own {relationship_type}"
        )));
    }

    if find_edge_either_direction(conn, a, b, relationship_type)?.is_some() {
        return Err(LoreError::InvalidInput(format!(
            "these entities are already linked as {relationship_type}"
        )));
    }

    if find_edge_either_direction(conn, a, b, opposite_type)?.is_some() {
        return Err(LoreError::InvalidInput(format!(
            "these entities are already linked as {opposite_type}; a pair cannot be both {relationship_type} and {opposite_type}"
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

/// The ids linked to `entity_id` via `relationship_type`, resolved
/// regardless of which side of the underlying relationship row
/// `entity_id` happens to be on. Callers resolve these ids into full
/// records via their own entity type's `get()`.
pub fn list_symmetric_link_ids(
    conn: &Connection,
    entity_id: &str,
    relationship_type: &str,
) -> Result<Vec<String>> {
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
        out.push(if source == entity_id { target } else { source });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::models::NewCharacter;

    fn setup() -> Connection {
        db::open_in_memory().expect("open in-memory db")
    }

    // Exercised here with characters as a stand-in entity type, purely to
    // prove the generic helper itself works in isolation from any
    // specific business module -- Politics' and Organizations' own test
    // suites are the real correctness proof for their respective usages
    // (mirroring hierarchy.rs's NFR3 approach).
    #[test]
    fn create_symmetric_edge_resolves_links_regardless_of_initiating_direction() {
        let conn = setup();
        let a = characters::create(&conn, NewCharacter { name: "A".into(), ..Default::default() }).unwrap();
        let b = characters::create(&conn, NewCharacter { name: "B".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &a.id, &b.id, "test_allied", "test_rival").unwrap();

        assert_eq!(list_symmetric_link_ids(&conn, &a.id, "test_allied").unwrap(), vec![b.id.clone()]);
        assert_eq!(list_symmetric_link_ids(&conn, &b.id, "test_allied").unwrap(), vec![a.id.clone()]);
    }

    #[test]
    fn create_symmetric_edge_rejects_a_duplicate_in_the_reverse_direction() {
        let conn = setup();
        let a = characters::create(&conn, NewCharacter { name: "A".into(), ..Default::default() }).unwrap();
        let b = characters::create(&conn, NewCharacter { name: "B".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &a.id, &b.id, "test_allied", "test_rival").unwrap();
        let err = create_symmetric_edge(&conn, &b.id, &a.id, "test_allied", "test_rival").unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_symmetric_edge_rejects_the_opposite_type_between_the_same_pair() {
        let conn = setup();
        let a = characters::create(&conn, NewCharacter { name: "A".into(), ..Default::default() }).unwrap();
        let b = characters::create(&conn, NewCharacter { name: "B".into(), ..Default::default() }).unwrap();

        create_symmetric_edge(&conn, &a.id, &b.id, "test_allied", "test_rival").unwrap();
        let err = create_symmetric_edge(&conn, &b.id, &a.id, "test_rival", "test_allied").unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }

    #[test]
    fn create_symmetric_edge_rejects_a_self_link() {
        let conn = setup();
        let a = characters::create(&conn, NewCharacter { name: "A".into(), ..Default::default() }).unwrap();
        let err = create_symmetric_edge(&conn, &a.id, &a.id, "test_allied", "test_rival").unwrap_err();
        assert!(matches!(err, LoreError::InvalidInput(_)));
    }
}
