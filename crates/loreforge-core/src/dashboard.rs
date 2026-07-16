use crate::error::Result;
use crate::models::DashboardMetrics;
use rusqlite::Connection;

pub fn get_metrics(conn: &Connection) -> Result<DashboardMetrics> {
    let characters_total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM entities WHERE entity_type = 'character' AND deleted_at IS NULL",
        [],
        |r| r.get(0),
    )?;

    let characters_main: i64 = conn.query_row(
        "SELECT COUNT(*) FROM entities e JOIN character_details cd ON cd.entity_id = e.id
         WHERE e.entity_type = 'character' AND e.deleted_at IS NULL AND cd.role = 'main'",
        [],
        |r| r.get(0),
    )?;

    let characters_supporting: i64 = conn.query_row(
        "SELECT COUNT(*) FROM entities e JOIN character_details cd ON cd.entity_id = e.id
         WHERE e.entity_type = 'character' AND e.deleted_at IS NULL AND cd.role = 'supporting'",
        [],
        |r| r.get(0),
    )?;

    let characters_needs_development: i64 = conn.query_row(
        "SELECT COUNT(*) FROM entities e JOIN character_details cd ON cd.entity_id = e.id
         WHERE e.entity_type = 'character' AND e.deleted_at IS NULL AND cd.needs_development = 1",
        [],
        |r| r.get(0),
    )?;

    let relationships_total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM relationships WHERE deleted_at IS NULL",
        [],
        |r| r.get(0),
    )?;

    Ok(DashboardMetrics {
        characters_total,
        characters_main,
        characters_supporting,
        characters_needs_development,
        relationships_total,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::models::{CharacterPatch, NewCharacter};

    #[test]
    fn metrics_reflect_live_data() {
        let conn = db::open_in_memory().unwrap();
        characters::create(&conn, NewCharacter { name: "A".into(), role: Some("main".into()), ..Default::default() }).unwrap();
        let supporting = characters::create(&conn, NewCharacter { name: "B".into(), role: Some("supporting".into()), ..Default::default() }).unwrap();
        characters::update(&conn, &supporting.id, CharacterPatch { needs_development: Some(true), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.characters_total, 2);
        assert_eq!(metrics.characters_main, 1);
        assert_eq!(metrics.characters_supporting, 1);
        assert_eq!(metrics.characters_needs_development, 1);
    }
}
