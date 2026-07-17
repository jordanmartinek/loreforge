use crate::canon;
use crate::error::Result;
use crate::events;
use crate::locations;
use crate::military;
use crate::models::{
    CanonFilter, DashboardMetrics, EventFilter, LocationFilter, MilitaryUnitFilter,
    PoliticalEntityFilter, ReligionFilter, SpeciesFilter, TechnologyFilter,
};
use crate::politics;
use crate::religions;
use crate::species;
use crate::technologies;
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

    // Canon metrics (Phase 3).
    let all_canon_entries = canon::list(conn, &CanonFilter::default())?;
    let mut canon_approved = 0i64;
    let mut canon_draft = 0i64;
    let mut canon_under_review = 0i64;
    let mut canon_deprecated = 0i64;
    for entry in &all_canon_entries {
        match entry.status.as_str() {
            "approved" => canon_approved += 1,
            "draft" => canon_draft += 1,
            "under_review" => canon_under_review += 1,
            "deprecated" => canon_deprecated += 1,
            _ => {}
        }
    }

    // Location metrics (Phase 4).
    let all_locations = locations::list(conn, &LocationFilter::default())?;
    let locations_total = all_locations.len() as i64;
    let location_types_seen: HashSet<String> =
        all_locations.iter().map(|l| l.location_type.clone()).collect();

    // Technology metrics (Phase 5).
    let all_technologies = technologies::list(conn, &TechnologyFilter::default())?;
    let technologies_total = all_technologies.len() as i64;
    let technology_categories_seen: HashSet<String> =
        all_technologies.iter().map(|t| t.category.clone()).collect();

    // Species metrics (Phase 6).
    let all_species = species::list(conn, &SpeciesFilter::default())?;
    let species_total = all_species.len() as i64;
    let species_classifications_seen: HashSet<String> =
        all_species.iter().map(|s| s.classification.clone()).collect();

    // Military metrics (Phase 7).
    let all_units = military::list(conn, &MilitaryUnitFilter::default())?;
    let military_units_total = all_units.len() as i64;
    let military_branches_seen: HashSet<String> =
        all_units.iter().map(|u| u.branch.clone()).collect();

    // Politics metrics (Phase 8).
    let all_political_entities = politics::list(conn, &PoliticalEntityFilter::default())?;
    let political_entities_total = all_political_entities.len() as i64;
    let political_classifications_seen: HashSet<String> =
        all_political_entities.iter().map(|p| p.classification.clone()).collect();

    // Religions metrics (Phase 9).
    let all_religions = religions::list(conn, &ReligionFilter::default())?;
    let religions_total = all_religions.len() as i64;
    let religion_classifications_seen: HashSet<String> =
        all_religions.iter().map(|r| r.classification.clone()).collect();

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
        canon_approved,
        canon_draft,
        canon_under_review,
        canon_deprecated,
        locations_total,
        location_types_in_use: location_types_seen.len() as i64,
        technologies_total,
        technology_categories_in_use: technology_categories_seen.len() as i64,
        species_total,
        species_classifications_in_use: species_classifications_seen.len() as i64,
        military_units_total,
        military_branches_in_use: military_branches_seen.len() as i64,
        political_entities_total,
        political_classifications_in_use: political_classifications_seen.len() as i64,
        religions_total,
        religion_classifications_in_use: religion_classifications_seen.len() as i64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::canon;
    use crate::characters;
    use crate::db;
    use crate::locations;
    use crate::military;
    use crate::models::{
        CharacterPatch, NewCanonEntry, NewCharacter, NewEvent, NewLocation, NewMilitaryUnit,
        NewPoliticalEntity, NewReligion, NewSpecies, NewTechnology,
    };
    use crate::politics;
    use crate::religions;
    use crate::species;
    use crate::technologies;

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

    #[test]
    fn metrics_reflect_live_canon_data() {
        let conn = db::open_in_memory().unwrap();
        canon::create(&conn, NewCanonEntry { name: "A".into(), status: Some("approved".into()), ..Default::default() }).unwrap();
        canon::create(&conn, NewCanonEntry { name: "B".into(), status: Some("draft".into()), ..Default::default() }).unwrap();
        canon::create(&conn, NewCanonEntry { name: "C".into(), ..Default::default() }).unwrap(); // defaults to draft
        canon::create(&conn, NewCanonEntry { name: "D".into(), status: Some("under_review".into()), ..Default::default() }).unwrap();
        canon::create(&conn, NewCanonEntry { name: "E".into(), status: Some("deprecated".into()), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.canon_approved, 1);
        assert_eq!(metrics.canon_draft, 2);
        assert_eq!(metrics.canon_under_review, 1);
        assert_eq!(metrics.canon_deprecated, 1);
    }

    #[test]
    fn metrics_reflect_live_location_data() {
        let conn = db::open_in_memory().unwrap();
        locations::create(&conn, NewLocation { name: "Sol System".into(), location_type: Some("solar_system".into()), ..Default::default() }).unwrap();
        locations::create(&conn, NewLocation { name: "Earth".into(), location_type: Some("planet".into()), ..Default::default() }).unwrap();
        locations::create(&conn, NewLocation { name: "Mars".into(), location_type: Some("planet".into()), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.locations_total, 3);
        assert_eq!(metrics.location_types_in_use, 2); // solar_system, planet
    }

    #[test]
    fn metrics_reflect_live_technology_data() {
        let conn = db::open_in_memory().unwrap();
        technologies::create(&conn, NewTechnology { name: "Void Drive".into(), category: Some("void_technology".into()), ..Default::default() }).unwrap();
        technologies::create(&conn, NewTechnology { name: "Plasma Rifle".into(), category: Some("weapons".into()), ..Default::default() }).unwrap();
        technologies::create(&conn, NewTechnology { name: "Rail Gun".into(), category: Some("weapons".into()), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.technologies_total, 3);
        assert_eq!(metrics.technology_categories_in_use, 2); // void_technology, weapons
    }

    #[test]
    fn metrics_reflect_live_species_data() {
        let conn = db::open_in_memory().unwrap();
        species::create(&conn, NewSpecies { name: "Elari".into(), classification: Some("sentient_humanoid".into()), ..Default::default() }).unwrap();
        species::create(&conn, NewSpecies { name: "Void Wisp".into(), classification: Some("synthetic".into()), ..Default::default() }).unwrap();
        species::create(&conn, NewSpecies { name: "Sky Ray".into(), classification: Some("non_sentient_fauna".into()), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.species_total, 3);
        assert_eq!(metrics.species_classifications_in_use, 3);
    }

    #[test]
    fn metrics_reflect_live_military_data() {
        let conn = db::open_in_memory().unwrap();
        military::create(&conn, NewMilitaryUnit { name: "1st Battalion".into(), branch: Some("army".into()), ..Default::default() }).unwrap();
        military::create(&conn, NewMilitaryUnit { name: "3rd Fleet".into(), branch: Some("navy".into()), ..Default::default() }).unwrap();
        military::create(&conn, NewMilitaryUnit { name: "Shadow Cell".into(), branch: Some("special_forces".into()), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.military_units_total, 3);
        assert_eq!(metrics.military_branches_in_use, 3);
    }

    #[test]
    fn metrics_reflect_live_politics_data() {
        let conn = db::open_in_memory().unwrap();
        politics::create(&conn, NewPoliticalEntity { name: "Meridian Concord".into(), classification: Some("alliance".into()), ..Default::default() }).unwrap();
        politics::create(&conn, NewPoliticalEntity { name: "Void Collective".into(), classification: Some("faction".into()), ..Default::default() }).unwrap();
        politics::create(&conn, NewPoliticalEntity { name: "Ashgard Dominion".into(), classification: Some("government".into()), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.political_entities_total, 3);
        assert_eq!(metrics.political_classifications_in_use, 3);
    }

    #[test]
    fn metrics_reflect_live_religions_data() {
        let conn = db::open_in_memory().unwrap();
        religions::create(&conn, NewReligion { name: "Solari Faith".into(), classification: Some("organized_religion".into()), ..Default::default() }).unwrap();
        religions::create(&conn, NewReligion { name: "Whisper Cult".into(), classification: Some("cult".into()), ..Default::default() }).unwrap();
        religions::create(&conn, NewReligion { name: "Void Reckoning".into(), classification: Some("philosophy".into()), ..Default::default() }).unwrap();

        let metrics = get_metrics(&conn).unwrap();
        assert_eq!(metrics.religions_total, 3);
        assert_eq!(metrics.religion_classifications_in_use, 3);
    }
}
