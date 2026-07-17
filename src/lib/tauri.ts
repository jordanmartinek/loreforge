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
  NewRelationship,
  NewSpecies,
  NewTechnology,
  Relationship,
  RelationshipPatch,
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
  dashboard: {
    getMetrics: () => invoke<DashboardMetrics>("get_dashboard_metrics"),
  },
};
