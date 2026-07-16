use rusqlite::Connection;
use std::sync::Mutex;

/// Shared app state: a single writer connection guarded by a mutex, per the
/// "single writer connection, WAL mode" design in the Phase 1 design doc.
pub struct AppState {
    pub conn: Mutex<Connection>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self { conn: Mutex::new(conn) }
    }
}
