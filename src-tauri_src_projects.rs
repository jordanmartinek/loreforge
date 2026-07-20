use crate::state::AppState;
use loreforge_core::projects::{self, ProjectInfo};
use tauri::State;

// Thin adapter layer, same pattern as commands.rs: the actual registry
// logic lives in loreforge_core::projects. The one thing these commands do
// beyond that is swap the shared `conn` in AppState to point at whichever
// project's database is now active.

#[tauri::command]
pub fn list_projects(state: State<AppState>) -> Result<Vec<ProjectInfo>, String> {
    projects::list(&state.projects_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(state: State<AppState>, name: String) -> Result<ProjectInfo, String> {
    let info = projects::create(&state.projects_dir, &name).map_err(|e| e.to_string())?;

    let db_path = projects::db_path(&state.projects_dir, &info.id);
    let conn = loreforge_core::db::open(db_path).map_err(|e| e.to_string())?;
    *state.conn.lock().map_err(|e| e.to_string())? = conn;

    Ok(info)
}

#[tauri::command]
pub fn open_project(state: State<AppState>, id: String) -> Result<ProjectInfo, String> {
    let info = projects::touch(&state.projects_dir, &id).map_err(|e| e.to_string())?;

    let db_path = projects::db_path(&state.projects_dir, &id);
    let conn = loreforge_core::db::open(db_path).map_err(|e| e.to_string())?;
    *state.conn.lock().map_err(|e| e.to_string())? = conn;

    Ok(info)
}

#[tauri::command]
pub fn rename_project(
    state: State<AppState>,
    id: String,
    name: String,
) -> Result<ProjectInfo, String> {
    projects::rename(&state.projects_dir, &id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(state: State<AppState>, id: String) -> Result<(), String> {
    projects::delete(&state.projects_dir, &id).map_err(|e| e.to_string())
}
