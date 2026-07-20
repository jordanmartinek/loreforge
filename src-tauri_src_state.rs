use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

/// Shared app state: a single writer connection guarded by a mutex, per the
/// "single writer connection, WAL mode" design in the Phase 1 design doc.
///
/// `conn` always points at *some* open database -- at startup it's a
/// throwaway in-memory db (so every existing command still "works", just
/// returns empty results) until the user opens or creates a project, at
/// which point `projects::open_project`/`create_project` swap it out for
/// that project's real on-disk file. This means none of the 70+ existing
/// entity commands in `commands.rs` needed to change: they just keep
/// locking `conn` exactly as before.
pub struct AppState {
    pub conn: Mutex<Connection>,
    pub projects_dir: PathBuf,
}

impl AppState {
    pub fn new(conn: Connection, projects_dir: PathBuf) -> Self {
        Self {
            conn: Mutex::new(conn),
            projects_dir,
        }
    }
}
