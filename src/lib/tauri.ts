// Typed wrappers around Tauri's `invoke`, one function per Rust command in
// src-tauri/src/commands.rs. Keeping every IPC call behind a typed function
// here (instead of calling `invoke` directly from components) means the
// React Query hooks and UI never need to know the raw command names.

import { invoke } from "@tauri-apps/api/core";
import type {
  CanonEntry,
  CanonEntryPatch,
  CanonFilter,
  Character,
  CharacterFilter,
  CharacterPatch,
  DashboardMetrics,
  Event,
  EventFilter,
  EventPatch,
  Location,
  LocationFilter,
  LocationPatch,
  MilitaryUnit,
  MilitaryUnitFilter,
  MilitaryUnitPatch,
  NewCanonEntry,
  NewCharacter,
  NewEvent,
  NewLocation,
  NewMilitaryUnit,
  NewOrganization,
  NewPoliticalEntity,
  NewRelationship,
  NewSpecies,
  NewTechnology,
  NewReligion,
  Organization,
  OrganizationFilter,
  OrganizationPatch,
  PoliticalEntity,
  PoliticalEntityFilter,
  PoliticalEntityPatch,
  Relationship,
  RelationshipPatch,
  Religion,
  ReligionFilter,
  ReligionPatch,
  RevisionEntry,
  Species,
  SpeciesFilter,
  SpeciesPatch,
  Technology,
  TechnologyFilter,
  TechnologyPatch,
} from "./types";

export const api = {
  characters: {
    list: (filter: CharacterFilter = {}) =>
      invoke<Character[]>("list_characters", { filter }),
    get: (id: string) => invoke<Character>("get_character", { id }),
    create: (input: NewCharacter) =>
      invoke<Character>("create_character", { input }),
    update: (id: string, patch: CharacterPatch) =>
      invoke<Character>("update_character", { id, patch }),
    delete: (id: string) => invoke<void>("delete_character", { id }),
  },
  relationships: {
    listAll: () => invoke<Relationship[]>("list_relationships"),
    listForEntity: (entityId: string) =>
      invoke<Relationship[]>("list_relationships_for_entity", {
        entityId,
      }),
    create: (input: NewRelationship) =>
      invoke<Relationship>("create_relationship", { input }),
    update: (id: string, patch: RelationshipPatch) =>
      invoke<Relationship>("update_relationship", { id, patch }),
    delete: (id: string) => invoke<void>("delete_relationship", { id }),
  },
  events: {
    list: (filter: EventFilter = {}) => invoke<Event[]>("list_events", { filter }),
    get: (id: string) => invoke<Event>("get_event", { id }),
    create: (input: NewEvent) => invoke<Event>("create_event", { input }),
    update: (id: string, patch: EventPatch) =>
      invoke<Event>("update_event", { id, patch }),
    delete: (id: string) => invoke<void>("delete_event", { id }),
  },
  canon: {
    list: (filter: CanonFilter = {}) =>
      invoke<CanonEntry[]>("list_canon_entries", { filter }),
    get: (id: string) => invoke<CanonEntry>("get_canon_entry", { id }),
    create: (input: NewCanonEntry) =>
      invoke<CanonEntry>("create_canon_entry", { input }),
    update: (id: string, patch: CanonEntryPatch) =>
      invoke<CanonEntry>("update_canon_entry", { id, patch }),
    delete: (id: string) => invoke<void>("delete_canon_entry", { id }),
  },
  revisions: {
    listForEntity: (entityId: string, limit: number = 50) =>
      invoke<RevisionEntry[]>("list_revisions_for_entity", { entityId, limit }),
  },
  locations: {
    list: (filter: LocationFilter = {}) =>
      invoke<Location[]>("list_locations", { filter }),
    get: (id: string) => invoke<Location>("get_location", { id }),
    create: (input: NewLocation) =>
      invoke<Location>("create_location", { input }),
    update: (id: string, patch: LocationPatch) =>
      invoke<Location>("update_location", { id, patch }),
    delete: (id: string) => invoke<void>("delete_location", { id }),
    listChildren: (parentId: string | null) =>
      invoke<Location[]>("list_location_children", { parentId }),
    getAncestryChain: (id: string) =>
      invoke<Location[]>("get_location_ancestry_chain", { id }),
  },
  technologies: {
    list: (filter: TechnologyFilter = {}) =>
      invoke<Technology[]>("list_technologies", { filter }),
    get: (id: string) => invoke<Technology>("get_technology", { id }),
    create: (input: NewTechnology) =>
      invoke<Technology>("create_technology", { input }),
    update: (id: string, patch: TechnologyPatch) =>
      invoke<Technology>("update_technology", { id, patch }),
    delete: (id: string) => invoke<void>("delete_technology", { id }),
    listPrerequisites: (technologyId: string) =>
      invoke<Technology[]>("list_technology_prerequisites", { technologyId }),
    listDependents: (technologyId: string) =>
      invoke<Technology[]>("list_technology_dependents", { technologyId }),
    createRequiresEdge: (dependentId: string, prerequisiteId: string) =>
      invoke<Relationship>("create_requires_edge", {
        dependentId,
        prerequisiteId,
      }),
  },
  species: {
    list: (filter: SpeciesFilter = {}) => invoke<Species[]>("list_species", { filter }),
    get: (id: string) => invoke<Species>("get_species_entry", { id }),
    create: (input: NewSpecies) => invoke<Species>("create_species", { input }),
    update: (id: string, patch: SpeciesPatch) =>
      invoke<Species>("update_species", { id, patch }),
    delete: (id: string) => invoke<void>("delete_species", { id }),
    listSubspecies: (parentId: string | null) =>
      invoke<Species[]>("list_subspecies", { parentId }),
  },
  military: {
    list: (filter: MilitaryUnitFilter = {}) =>
      invoke<MilitaryUnit[]>("list_military_units", { filter }),
    get: (id: string) => invoke<MilitaryUnit>("get_military_unit", { id }),
    create: (input: NewMilitaryUnit) => invoke<MilitaryUnit>("create_military_unit", { input }),
    update: (id: string, patch: MilitaryUnitPatch) =>
      invoke<MilitaryUnit>("update_military_unit", { id, patch }),
    delete: (id: string) => invoke<void>("delete_military_unit", { id }),
    listSubordinateUnits: (parentId: string | null) =>
      invoke<MilitaryUnit[]>("list_subordinate_units", { parentId }),
  },
  politics: {
    list: (filter: PoliticalEntityFilter = {}) =>
      invoke<PoliticalEntity[]>("list_political_entities", { filter }),
    get: (id: string) => invoke<PoliticalEntity>("get_political_entity", { id }),
    create: (input: NewPoliticalEntity) =>
      invoke<PoliticalEntity>("create_political_entity", { input }),
    update: (id: string, patch: PoliticalEntityPatch) =>
      invoke<PoliticalEntity>("update_political_entity", { id, patch }),
    delete: (id: string) => invoke<void>("delete_political_entity", { id }),
    createSymmetricEdge: (a: string, b: string, relationshipType: string) =>
      invoke<Relationship>("create_symmetric_edge", { a, b, relationshipType }),
    listAllies: (entityId: string) =>
      invoke<PoliticalEntity[]>("list_political_allies", { entityId }),
    listRivals: (entityId: string) =>
      invoke<PoliticalEntity[]>("list_political_rivals", { entityId }),
  },
  religions: {
    list: (filter: ReligionFilter = {}) => invoke<Religion[]>("list_religions", { filter }),
    get: (id: string) => invoke<Religion>("get_religion", { id }),
    create: (input: NewReligion) => invoke<Religion>("create_religion", { input }),
    update: (id: string, patch: ReligionPatch) =>
      invoke<Religion>("update_religion", { id, patch }),
    delete: (id: string) => invoke<void>("delete_religion", { id }),
    listSchisms: (parentId: string | null) => invoke<Religion[]>("list_schisms", { parentId }),
  },
  organizations: {
    list: (filter: OrganizationFilter = {}) =>
      invoke<Organization[]>("list_organizations", { filter }),
    get: (id: string) => invoke<Organization>("get_organization", { id }),
    create: (input: NewOrganization) => invoke<Organization>("create_organization", { input }),
    update: (id: string, patch: OrganizationPatch) =>
      invoke<Organization>("update_organization", { id, patch }),
    delete: (id: string) => invoke<void>("delete_organization", { id }),
    listSubsidiaries: (parentId: string | null) =>
      invoke<Organization[]>("list_subsidiaries", { parentId }),
    createSymmetricEdge: (a: string, b: string, relationshipType: string) =>
      invoke<Relationship>("create_org_symmetric_edge", { a, b, relationshipType }),
    listAllies: (entityId: string) => invoke<Organization[]>("list_org_allies", { entityId }),
    listRivals: (entityId: string) => invoke<Organization[]>("list_org_rivals", { entityId }),
  },
  dashboard: {
    getMetrics: () => invoke<DashboardMetrics>("get_dashboard_metrics"),
  },
};
