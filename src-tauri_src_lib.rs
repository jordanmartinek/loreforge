mod commands;
mod projects;
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

      // Local-first persistence: each project gets its own SQLite file
      // under <app-data>/projects/<project-id>/loreforge.db (per
      // design.md section 1/3), tracked by a small projects.json registry.
      let app_data_dir = app.path().app_data_dir()?;
      std::fs::create_dir_all(&app_data_dir)?;
      let projects_dir = app_data_dir.join("projects");
      std::fs::create_dir_all(&projects_dir)?;

      // No project is open yet at launch -- the frontend shows a picker
      // and calls open_project/create_project once the user chooses. Until
      // then, `conn` points at a throwaway in-memory db so the existing
      // entity commands don't need to special-case "no project selected";
      // they just see an empty database.
      let conn = loreforge_core::db::open_in_memory()
        .map_err(|e| format!("failed to open placeholder database: {e}"))?;

      app.manage(AppState::new(conn, projects_dir));

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      projects::list_projects,
      projects::create_project,
      projects::open_project,
      projects::rename_project,
      projects::delete_project,
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
      commands::list_locations,
      commands::get_location,
      commands::create_location,
      commands::update_location,
      commands::delete_location,
      commands::list_location_children,
      commands::get_location_ancestry_chain,
      commands::list_technologies,
      commands::get_technology,
      commands::create_technology,
      commands::update_technology,
      commands::delete_technology,
      commands::list_technology_prerequisites,
      commands::list_technology_dependents,
      commands::create_requires_edge,
      commands::list_species,
      commands::get_species_entry,
      commands::create_species,
      commands::update_species,
      commands::delete_species,
      commands::list_subspecies,
      commands::list_military_units,
      commands::get_military_unit,
      commands::create_military_unit,
      commands::update_military_unit,
      commands::delete_military_unit,
      commands::list_subordinate_units,
      commands::list_political_entities,
      commands::get_political_entity,
      commands::create_political_entity,
      commands::update_political_entity,
      commands::delete_political_entity,
      commands::create_symmetric_edge,
      commands::list_political_allies,
      commands::list_political_rivals,
      commands::list_religions,
      commands::get_religion,
      commands::create_religion,
      commands::update_religion,
      commands::delete_religion,
      commands::list_schisms,
      commands::list_organizations,
      commands::get_organization,
      commands::create_organization,
      commands::update_organization,
      commands::delete_organization,
      commands::list_subsidiaries,
      commands::create_org_symmetric_edge,
      commands::list_org_allies,
      commands::list_org_rivals,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
