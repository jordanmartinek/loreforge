use crate::error::Result;
use crate::events;
use crate::models::{DashboardMetrics, EventFilter};
use rusqlite::Connection;
use std::collections::HashSet;

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

    // Timeline metrics (Phase 2). Layers-in-use and the date span are
    // computed by walking the (typically small, hundreds-to-thousands)
    // event list in Rust rather than a JSON1 SQL query, since we can't
    // assume the JSON1 SQLite extension is compiled in -- see
    // events::list's own comment on the same tradeoff for layer filtering.
    let all_events = events::list(conn, &EventFilter::default())?;
    let events_total = all_events.len() as i64;

    let mut layers_seen: HashSet<String> = HashSet::new();
    let mut earliest_event_date: Option<String> = None;
    let mut latest_event_date: Option<String> = None;

    for event in &all_events {
        for layer in &event.layers {
            layers_seen.insert(layer.clone());
        }
        if earliest_event_date.as_deref().is_none_or(|earliest| event.start_date.as_str() < earliest) {
            earliest_event_date = Some(event.start_date.clone());
        }
        let comparable_end = event.end_date.as_deref().unwrap_or(&event.start_date);
        if latest_event_date.as_deref().is_none_or(|latest| comparable_end > latest) {
            latest_event_date = Some(comparable_end.to_string());
        }
    }

    Ok(DashboardMetrics {
        characters_total,
        characters_main,
        characters_supporting,
        characters_needs_development,
        relationships_total,
        events_total,
        layers_in_use: layers_seen.len() as i64,
        earliest_event_date,
        latest_event_date,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::characters;
    use crate::db;
    use crate::models::{CharacterPatch, NewCharacter, NewEvent};

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

    #[test]
    fn metrics_reflect_live_timeline_data() {
        let conn = db::open_in_memory().unwrap();
        events::create(
            &conn,
            NewEvent {
                name: "Founding".into(),
                start_date: "2100-01-01".into(),
                layers: Some(vec!["historical".into()]),
                ..Default::default()
            },
        )
        .unwrap();
        events::create(
            &conn,
            NewEvent {
                name: "The AI War".into(),
                start_date: "2140-01-01".into(),
                end_date: Some("2142-06-01".into()),
                layers: Some(vec!["military".into(), "wars".into()]),
                ..Default::default()
            },
        )
        .unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.events_total, 2);
        assert_eq!(metrics.layers_in_use, 3); // historical, military, wars
        assert_eq!(metrics.earliest_event_date, Some("2100-01-01".to_string()));
        assert_eq!(metrics.latest_event_date, Some("2142-06-01".to_string()));
    }
}
