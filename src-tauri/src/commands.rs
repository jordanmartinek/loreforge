use crate::state::AppState;
use loreforge_core::models::{
    CanonEntry, CanonEntryPatch, CanonFilter, Character, CharacterFilter, CharacterPatch,
    DashboardMetrics, Event, EventFilter, EventPatch, NewCanonEntry, NewCharacter, NewEvent,
    NewRelationship, Relationship, RelationshipPatch, RevisionEntry,
};
use loreforge_core::{canon, characters, dashboard, events, relationships, revisions};
use tauri::State;

// Every command maps 1:1 to a loreforge-core function. Errors are converted
// to strings for the frontend; this keeps the IPC boundary simple while the
// real error variants stay in loreforge-core for anything that needs to
// pattern-match on them (e.g. future tests).

#[tauri::command]
pub fn list_characters(
    state: State<AppState>,
    filter: CharacterFilter,
) -> Result<Vec<Character>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    characters::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_character(state: State<AppState>, id: String) -> Result<Character, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    characters::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_character(
    state: State<AppState>,
    input: NewCharacter,
) -> Result<Character, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    characters::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_character(
    state: State<AppState>,
    id: String,
    patch: CharacterPatch,
) -> Result<Character, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    characters::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_character(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    characters::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_relationships(state: State<AppState>) -> Result<Vec<Relationship>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    relationships::list_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_relationships_for_entity(
    state: State<AppState>,
    entity_id: String,
) -> Result<Vec<Relationship>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    relationships::list_for_entity(&conn, &entity_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_relationship(
    state: State<AppState>,
    input: NewRelationship,
) -> Result<Relationship, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    relationships::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_relationship(
    state: State<AppState>,
    id: String,
    patch: RelationshipPatch,
) -> Result<Relationship, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    relationships::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_relationship(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    relationships::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_dashboard_metrics(state: State<AppState>) -> Result<DashboardMetrics, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    dashboard::get_metrics(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_events(state: State<AppState>, filter: EventFilter) -> Result<Vec<Event>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    events::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_event(state: State<AppState>, id: String) -> Result<Event, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    events::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_event(state: State<AppState>, input: NewEvent) -> Result<Event, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    events::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_event(
    state: State<AppState>,
    id: String,
    patch: EventPatch,
) -> Result<Event, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    events::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_event(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    events::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_canon_entries(
    state: State<AppState>,
    filter: CanonFilter,
) -> Result<Vec<CanonEntry>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    canon::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_canon_entry(state: State<AppState>, id: String) -> Result<CanonEntry, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    canon::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_canon_entry(
    state: State<AppState>,
    input: NewCanonEntry,
) -> Result<CanonEntry, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    canon::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_canon_entry(
    state: State<AppState>,
    id: String,
    patch: CanonEntryPatch,
) -> Result<CanonEntry, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    canon::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_canon_entry(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    canon::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_revisions_for_entity(
    state: State<AppState>,
    entity_id: String,
    limit: i64,
) -> Result<Vec<RevisionEntry>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    revisions::list_for_record(&conn, &entity_id, limit).map_err(|e| e.to_string())
}
