use crate::error::Result;
use rusqlite::Connection;

/// All migrations, in order. Each is applied exactly once, tracked via the
/// `schema_migrations` table, so `run` is idempotent and safe to call on every
/// app startup.
const MIGRATIONS: &[(&str, &str)] = &[
    ("0001_init", include_str!("../migrations/0001_init.sql")),
    ("0002_events", include_str!("../migrations/0002_events.sql")),
    ("0003_canon", include_str!("../migrations/0003_canon.sql")),
    ("0004_locations", include_str!("../migrations/0004_locations.sql")),
    ("0005_technologies", include_str!("../migrations/0005_technologies.sql")),
];

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    for (name, sql) in MIGRATIONS {
        let already_applied: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = ?1)",
                [name],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if already_applied {
            continue;
        }

        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (name) VALUES (?1)",
            [name],
        )?;
    }

    Ok(())
}
