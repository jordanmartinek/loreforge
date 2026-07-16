// Typed wrappers around Tauri's `invoke`, one function per Rust command in
// src-tauri/src/commands.rs. Keeping every IPC call behind a typed function
// here (instead of calling `invoke` directly from components) means the
// React Query hooks and UI never need to know the raw command names.

import { invoke } from "@tauri-apps/api/core";
import type {
  Character,
  CharacterFilter,
  CharacterPatch,
  DashboardMetrics,
  Event,
  EventFilter,
  EventPatch,
  NewCharacter,
  NewEvent,
  NewRelationship,
  Relationship,
  RelationshipPatch,
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
  dashboard: {
    getMetrics: () => invoke<DashboardMetrics>("get_dashboard_metrics"),
  },
};
