//! loreforge-core: pure Rust domain + persistence layer for LoreForge AI.
//!
//! This crate has zero dependency on Tauri/GTK/webview so it can be built,
//! tested, and reasoned about in any Rust environment. The `src-tauri` crate
//! is a thin adapter that exposes these functions as Tauri commands.

pub mod canon;
pub mod characters;
pub mod dashboard;
pub mod db;
pub mod error;
pub mod events;
pub mod locations;
pub mod migrations;
pub mod models;
pub mod military;
pub mod politics;
pub mod relationships;
pub mod revisions;
pub mod species;
pub mod technologies;

pub use error::{LoreError, Result};
