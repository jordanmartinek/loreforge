//! Project registry: tracks the set of LoreForge projects (universes) a user
//! has created, each backed by its own SQLite database file on disk.
//!
//! Design: a lightweight `projects.json` index lives at the root of the
//! projects directory (e.g. `<app-data>/projects/projects.json`) so the
//! picker can list projects without opening every project's database. Each
//! project's actual data lives in its own subfolder:
//!
//!   <app-data>/projects/
//!     projects.json
//!     <project-id>/
//!       loreforge.db
//!
//! This module only manages the registry + folder layout. Opening/closing
//! the actual `Connection` for the active project is the caller's
//! responsibility (see `src-tauri/src/projects.rs`), since only the caller
//! knows how to swap the active connection held in its own app state.

use crate::error::{LoreError, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub last_opened_at: String,
}

fn registry_path(projects_dir: &Path) -> PathBuf {
    projects_dir.join("projects.json")
}

/// Folder that holds a given project's database (and, in future, any other
/// per-project files such as attachments).
pub fn project_dir(projects_dir: &Path, id: &str) -> PathBuf {
    projects_dir.join(id)
}

/// Path to a given project's SQLite database file.
pub fn db_path(projects_dir: &Path, id: &str) -> PathBuf {
    project_dir(projects_dir, id).join("loreforge.db")
}

/// Lists all known projects, most-recently-opened first isn't enforced here
/// -- callers/UI can sort by `last_opened_at` as needed.
pub fn list(projects_dir: &Path) -> Result<Vec<ProjectInfo>> {
    let path = registry_path(projects_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path)?;
    if data.trim().is_empty() {
        return Ok(Vec::new());
    }
    Ok(serde_json::from_str(&data)?)
}

fn save(projects_dir: &Path, projects: &[ProjectInfo]) -> Result<()> {
    fs::create_dir_all(projects_dir)?;
    let data = serde_json::to_string_pretty(projects)?;
    fs::write(registry_path(projects_dir), data)?;
    Ok(())
}

/// Registers a new project and creates its on-disk folder. Does NOT open
/// the database -- the caller opens `db_path(projects_dir, &info.id)` via
/// `crate::db::open` and installs the resulting connection into its own
/// state.
pub fn create(projects_dir: &Path, name: &str) -> Result<ProjectInfo> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(LoreError::InvalidInput(
            "project name is required".into(),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let info = ProjectInfo {
        id: id.clone(),
        name: trimmed.to_string(),
        created_at: now.clone(),
        last_opened_at: now,
    };

    fs::create_dir_all(project_dir(projects_dir, &id))?;

    let mut projects = list(projects_dir)?;
    projects.push(info.clone());
    save(projects_dir, &projects)?;

    Ok(info)
}

/// Bumps `last_opened_at` for an existing project and returns its info.
/// Errors if the id isn't registered.
pub fn touch(projects_dir: &Path, id: &str) -> Result<ProjectInfo> {
    let mut projects = list(projects_dir)?;
    let entry = projects
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| LoreError::NotFound(format!("project {id}")))?;
    entry.last_opened_at = Utc::now().to_rfc3339();
    let info = entry.clone();
    save(projects_dir, &projects)?;
    Ok(info)
}

pub fn rename(projects_dir: &Path, id: &str, name: &str) -> Result<ProjectInfo> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(LoreError::InvalidInput(
            "project name is required".into(),
        ));
    }

    let mut projects = list(projects_dir)?;
    let entry = projects
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| LoreError::NotFound(format!("project {id}")))?;
    entry.name = trimmed.to_string();
    let info = entry.clone();
    save(projects_dir, &projects)?;
    Ok(info)
}

/// Removes a project from the registry and deletes its on-disk folder
/// (database file included). This is destructive and irreversible.
pub fn delete(projects_dir: &Path, id: &str) -> Result<()> {
    let mut projects = list(projects_dir)?;
    projects.retain(|p| p.id != id);
    save(projects_dir, &projects)?;

    let dir = project_dir(projects_dir, id);
    if dir.exists() {
        fs::remove_dir_all(dir)?;
    }
    Ok(())
}
