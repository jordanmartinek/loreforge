mod commands;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Local-first persistence: the SQLite file lives in the OS app-data
      // dir, no cloud path involved (per design.md section 1/3).
      let app_data_dir = app.path().app_data_dir()?;
      std::fs::create_dir_all(&app_data_dir)?;
      let db_path = app_data_dir.join("loreforge.db");

      let conn = loreforge_core::db::open(db_path)
        .map_err(|e| format!("failed to open database: {e}"))?;

      app.manage(AppState::new(conn));

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::list_characters,
      commands::get_character,
      commands::create_character,
      commands::update_character,
      commands::delete_character,
      commands::list_relationships,
      commands::list_relationships_for_entity,
      commands::create_relationship,
      commands::update_relationship,
      commands::delete_relationship,
      commands::get_dashboard_metrics,
      commands::list_events,
      commands::get_event,
      commands::create_event,
      commands::update_event,
      commands::delete_event,
      commands::list_canon_entries,
      commands::get_canon_entry,
      commands::create_canon_entry,
      commands::update_canon_entry,
      commands::delete_canon_entry,
      commands::list_revisions_for_entity,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
