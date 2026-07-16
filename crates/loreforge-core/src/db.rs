use crate::error::Result;
use rusqlite::Connection;
use std::path::Path;

/// Opens (creating if needed) the SQLite database at `path`, configures it for
/// local-first, single-writer use (WAL mode, foreign keys on), and applies any
/// pending migrations.
pub fn open(path: impl AsRef<Path>) -> Result<Connection> {
    let conn = Connection::open(path)?;
    configure(&conn)?;
    crate::migrations::run(&conn)?;
    Ok(conn)
}

/// Opens a fully in-memory database. Handy for tests and for the sandbox
/// environment where we don't have a native window to derive an app-data dir
/// from.
pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    crate::migrations::run(&conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA synchronous = NORMAL;",
    )?;
    Ok(())
}
