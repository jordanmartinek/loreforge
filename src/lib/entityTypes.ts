// Shared entity-type registry. Originally introduced by Notes Import
// (Phase 11) as a parser-local concept, but the Universe Graph expansion
// (Phase 12) needs the exact same (key, label) pairs to build its
// filter/legend UI, so this lives in its own module that both features
// import from rather than one feature reaching into the other's file.
// notesParser.ts re-exports these three names unchanged so nothing that
// already imports them from "./notesParser" needs to change (see that
// file's top-of-file comment).

export type EntityTypeKey =
  | "character"
  | "location"
  | "technology"
  | "species"
  | "military"
  | "politics"
  | "religion"
  | "organization"
  | "canon"
  | "event";

export const ENTITY_TYPE_KEYS: EntityTypeKey[] = [
  "character",
  "location",
  "technology",
  "species",
  "military",
  "politics",
  "religion",
  "organization",
  "canon",
  "event",
];

export const ENTITY_TYPE_LABELS: Record<EntityTypeKey, string> = {
  character: "Character",
  location: "Location",
  technology: "Technology",
  species: "Species",
  military: "Military Unit",
  politics: "Political Entity",
  religion: "Religion",
  organization: "Organization",
  canon: "Canon Entry",
  event: "Event",
};

/** A fixed categorical palette, one hue per entity type, so a node's color
 * alone identifies its type at a glance on the Universe Graph (Phase 12
 * FR1.2) and doubles as the legend swatch color in GraphFilters. Chosen
 * for mutual distinguishability against the app's dark background tiers.
 * Deliberately independent of index.css's semantic --color-success/
 * -warning/-danger tokens -- a node being "military" or "religion" isn't
 * a warning/danger state, so reusing those tokens here would accidentally
 * imply a severity meaning that isn't intended. */
export const ENTITY_TYPE_COLORS: Record<EntityTypeKey, string> = {
  character: "#7c7ff2",
  location: "#4fc3f7",
  technology: "#f2c14e",
  species: "#66bb6a",
  military: "#ef5d6f",
  politics: "#ba68c8",
  religion: "#ffa657",
  organization: "#4dd0e1",
  canon: "#9b9bab",
  event: "#f06292",
};
