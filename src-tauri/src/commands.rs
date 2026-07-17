use crate::state::AppState;
use loreforge_core::models::{
    CanonEntry, CanonEntryPatch, CanonFilter, Character, CharacterFilter, CharacterPatch,
    DashboardMetrics, Event, EventFilter, EventPatch, Location, LocationFilter, LocationPatch,
    MilitaryUnit, MilitaryUnitFilter, MilitaryUnitPatch, NewCanonEntry, NewCharacter, NewEvent,
    NewLocation, NewMilitaryUnit, NewOrganization, NewPoliticalEntity, NewRelationship,
    NewReligion, NewSpecies, NewTechnology, Organization, OrganizationFilter, OrganizationPatch,
    PoliticalEntity, PoliticalEntityFilter, PoliticalEntityPatch, Relationship,
    RelationshipPatch, Religion, ReligionFilter, ReligionPatch, RevisionEntry, Species,
    SpeciesFilter, SpeciesPatch, Technology, TechnologyFilter, TechnologyPatch,
};
use loreforge_core::{
    canon, characters, dashboard, events, locations, military, organizations, politics,
    relationships, religions, revisions, species, technologies,
};
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

#[tauri::command]
pub fn list_locations(
    state: State<AppState>,
    filter: LocationFilter,
) -> Result<Vec<Location>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    locations::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_location(state: State<AppState>, id: String) -> Result<Location, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    locations::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_location(
    state: State<AppState>,
    input: NewLocation,
) -> Result<Location, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    locations::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_location(
    state: State<AppState>,
    id: String,
    patch: LocationPatch,
) -> Result<Location, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    locations::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_location(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    locations::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_location_children(
    state: State<AppState>,
    parent_id: Option<String>,
) -> Result<Vec<Location>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    locations::list_children(&conn, parent_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_location_ancestry_chain(
    state: State<AppState>,
    id: String,
) -> Result<Vec<Location>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    locations::get_ancestry_chain(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_technologies(
    state: State<AppState>,
    filter: TechnologyFilter,
) -> Result<Vec<Technology>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_technology(state: State<AppState>, id: String) -> Result<Technology, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_technology(
    state: State<AppState>,
    input: NewTechnology,
) -> Result<Technology, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_technology(
    state: State<AppState>,
    id: String,
    patch: TechnologyPatch,
) -> Result<Technology, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_technology(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_technology_prerequisites(
    state: State<AppState>,
    technology_id: String,
) -> Result<Vec<Technology>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::list_prerequisites(&conn, &technology_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_technology_dependents(
    state: State<AppState>,
    technology_id: String,
) -> Result<Vec<Technology>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::list_dependents(&conn, &technology_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_requires_edge(
    state: State<AppState>,
    dependent_id: String,
    prerequisite_id: String,
) -> Result<Relationship, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    technologies::create_requires_edge(&conn, &dependent_id, &prerequisite_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_species(
    state: State<AppState>,
    filter: SpeciesFilter,
) -> Result<Vec<Species>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    species::list(&conn, &filter).map_err(|e| e.to_string())
}

// Named `get_species_entry`, not `get_species`, to avoid the ambiguity a
// singular-vs-plural command name would otherwise read fine as either "get
// this one species" or "get all species" (design-phase-6-species.md
// section 2). Internally this still just calls `species::get`.
#[tauri::command]
pub fn get_species_entry(state: State<AppState>, id: String) -> Result<Species, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    species::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_species(state: State<AppState>, input: NewSpecies) -> Result<Species, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    species::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_species(
    state: State<AppState>,
    id: String,
    patch: SpeciesPatch,
) -> Result<Species, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    species::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_species(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    species::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_subspecies(
    state: State<AppState>,
    parent_id: Option<String>,
) -> Result<Vec<Species>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    species::list_subspecies(&conn, parent_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_military_units(
    state: State<AppState>,
    filter: MilitaryUnitFilter,
) -> Result<Vec<MilitaryUnit>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    military::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_military_unit(state: State<AppState>, id: String) -> Result<MilitaryUnit, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    military::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_military_unit(
    state: State<AppState>,
    input: NewMilitaryUnit,
) -> Result<MilitaryUnit, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    military::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_military_unit(
    state: State<AppState>,
    id: String,
    patch: MilitaryUnitPatch,
) -> Result<MilitaryUnit, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    military::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_military_unit(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    military::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_subordinate_units(
    state: State<AppState>,
    parent_id: Option<String>,
) -> Result<Vec<MilitaryUnit>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    military::list_subordinate_units(&conn, parent_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_political_entities(
    state: State<AppState>,
    filter: PoliticalEntityFilter,
) -> Result<Vec<PoliticalEntity>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_political_entity(state: State<AppState>, id: String) -> Result<PoliticalEntity, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_political_entity(
    state: State<AppState>,
    input: NewPoliticalEntity,
) -> Result<PoliticalEntity, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_political_entity(
    state: State<AppState>,
    id: String,
    patch: PoliticalEntityPatch,
) -> Result<PoliticalEntity, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_political_entity(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::delete(&conn, &id).map_err(|e| e.to_string())
}

/// Covers both `allied_with` and `rival_of`: the `relationship_type`
/// parameter selects which symmetric relationship to create, mirroring
/// `politics::create_symmetric_edge`'s own signature
/// (design-phase-8-politics.md section 1.1).
#[tauri::command]
pub fn create_symmetric_edge(
    state: State<AppState>,
    a: String,
    b: String,
    relationship_type: String,
) -> Result<Relationship, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::create_symmetric_edge(&conn, &a, &b, &relationship_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_political_allies(
    state: State<AppState>,
    entity_id: String,
) -> Result<Vec<PoliticalEntity>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::list_allies(&conn, &entity_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_political_rivals(
    state: State<AppState>,
    entity_id: String,
) -> Result<Vec<PoliticalEntity>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    politics::list_rivals(&conn, &entity_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_religions(
    state: State<AppState>,
    filter: ReligionFilter,
) -> Result<Vec<Religion>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    religions::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_religion(state: State<AppState>, id: String) -> Result<Religion, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    religions::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_religion(state: State<AppState>, input: NewReligion) -> Result<Religion, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    religions::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_religion(
    state: State<AppState>,
    id: String,
    patch: ReligionPatch,
) -> Result<Religion, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    religions::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_religion(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    religions::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_schisms(
    state: State<AppState>,
    parent_id: Option<String>,
) -> Result<Vec<Religion>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    religions::list_schisms(&conn, parent_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_organizations(
    state: State<AppState>,
    filter: OrganizationFilter,
) -> Result<Vec<Organization>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::list(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_organization(state: State<AppState>, id: String) -> Result<Organization, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::get(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_organization(
    state: State<AppState>,
    input: NewOrganization,
) -> Result<Organization, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::create(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_organization(
    state: State<AppState>,
    id: String,
    patch: OrganizationPatch,
) -> Result<Organization, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::update(&conn, &id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_organization(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_subsidiaries(
    state: State<AppState>,
    parent_id: Option<String>,
) -> Result<Vec<Organization>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::list_subsidiaries(&conn, parent_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_org_symmetric_edge(
    state: State<AppState>,
    a: String,
    b: String,
    relationship_type: String,
) -> Result<Relationship, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::create_symmetric_edge(&conn, &a, &b, &relationship_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_org_allies(
    state: State<AppState>,
    entity_id: String,
) -> Result<Vec<Organization>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::list_org_allies(&conn, &entity_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_org_rivals(
    state: State<AppState>,
    entity_id: String,
) -> Result<Vec<Organization>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    organizations::list_org_rivals(&conn, &entity_id).map_err(|e| e.to_string())
}
