# LoreForge AI — Phase 4: World Explorer (Locations) — Requirements

## Context

The original brief describes navigating the universe visually through a location
hierarchy — Galaxy → Solar Systems → Planets → Stations → Cities → Ships → Buildings →
Rooms — instead of folders, with every location linking directly to characters, events,
technology, scenes, and organizations. Phase 4 implements this as the **World Explorer**:
a new `location` entity type with a self-referential parent/child hierarchy, plus a
`located_at` relationship connecting locations to characters and events (the only other
entity types that exist so far).

This is the first phase where the entity itself needs a tree structure, not just flat
rows linked by the generic `relationships` table. That tree lives on the `location`
entity type only — it does not require any change to the core `entities` /
`relationships` / `revisions` tables from Phase 1.

## Phase 4 Scope

1. **Location entity type** — a new `location_details` table with a nullable
   `parent_location_id` (self-referential, pointing at another location's entity id),
   plus a `location_type` field (galaxy | solar_system | planet | station | city | ship |
   building | room | other) and a description. Same soft-delete + revision-history
   pattern as every prior entity type.
2. **Hierarchy operations** — list direct children of a location, compute the full
   ancestry chain (breadcrumb) from a location up to its root, and reparent a location
   (change its `parent_location_id`).
3. **Deletion behavior** — deleting a location must not orphan its children into
   nonexistence or silently cascade-delete an entire subtree (data loss risk for a
   hierarchy is worse than for a flat list). Instead, deleting a location re-parents its
   direct children to its own parent (or to root, i.e. `NULL`, if it had none) — the
   subtree survives, just one level shallower.
4. **`located_at` relationship** — characters and events can be linked to the location(s)
   they're associated with, reusing the existing `relationships` table
   (`relationship_type = 'located_at'`, source = character/event, target = location) —
   no new join table.
5. **World Explorer UI** — a tree view (expand/collapse) as the primary navigation
   surface for locations, replacing a flat list as the main pattern (distinct from
   Characters/Events/Canon's flat virtualized lists, because locations are inherently
   hierarchical).
6. **Dashboard integration** — the existing "Locations" Coming Soon card becomes live,
   showing total locations and a breakdown by location type.

### Explicitly Out of Scope for Phase 4

Map/spatial visualization (coordinates, distances, travel time calculations — feeds the
later AI Continuity Checker's "impossible travel times" check, not this phase), linking
locations to Technology/Scenes/Organizations (those entity types don't exist yet — the
`located_at`-style relationship pattern established here is designed to extend to them
without rework), multi-parent locations (a location has at most one parent in this
phase; "this ship is docked at this station" is a future relationship type, not a second
parent edge).

## Functional Requirements

### FR1 — Location Entity & Hierarchy Data Model
- FR1.1: The system SHALL store locations as `entities` rows with
  `entity_type = 'location'`, plus a `location_details` row per location (name lives on
  `entities.name`, as with every prior entity type).
- FR1.2: Each location SHALL support: `location_type` (one of a fixed vocabulary: galaxy,
  solar_system, planet, station, city, ship, building, room, other), description, and an
  optional `parent_location_id` referencing another location's entity id.
- FR1.3: A location SHALL NOT be able to become its own ancestor (setting a location's
  parent to itself, or to one of its own descendants, must be rejected) — this prevents
  an infinite loop when walking the tree.
- FR1.4: Locations SHALL support soft delete and full revision history, identical to
  every prior entity type.

### FR2 — Hierarchy Queries
- FR2.1: The system SHALL be able to list the direct children of a given location (or of
  the root, i.e. locations with `parent_location_id IS NULL`).
- FR2.2: The system SHALL be able to compute the ancestry chain of a location: the
  ordered list of ancestors from the immediate parent up to the root, usable to render a
  breadcrumb ("Milky Way > Sol System > Earth > New Geneva").

### FR3 — Deletion & Reparenting
- FR3.1: Deleting a location SHALL reparent its direct children to the deleted
  location's own parent (or to root if it had none), so the subtree remains navigable
  and no descendant location is lost.
- FR3.2: Deleting a location SHALL cascade soft-delete any `relationships` touching it
  (e.g. `located_at` links from characters/events), without affecting the characters or
  events themselves — consistent with every prior phase's cascade contract.
- FR3.3: Reparenting SHALL be rejected if the new parent is the location itself or one of
  its own descendants (same cycle-prevention as FR1.3).

### FR4 — `located_at` Relationship
- FR4.1: Users SHALL be able to link a character to a location via a `located_at`
  relationship (source = character, target = location) representing "this character is
  currently/notably associated with this place."
- FR4.2: Users SHALL be able to link an event to a location the same way (source = event,
  target = location) representing "this event takes place here."
- FR4.3: A location's detail view SHALL show which characters and events are linked to it
  via `located_at`, and allow adding/removing those links.
- FR4.4: A character's or event's detail view SHALL show its linked location(s), if any
  (symmetric visibility, not just location-side).

### FR5 — World Explorer UI
- FR5.1: The primary Locations view SHALL be a collapsible tree (not a flat virtualized
  list, unlike Characters/Events/Canon), rooted at locations with no parent.
- FR5.2: Clicking a location in the tree SHALL open its detail view, showing a breadcrumb
  computed from FR2.2.
- FR5.3: Users SHALL be able to create a new location as a child of the currently
  selected location (or at root level).
- FR5.4: Users SHALL be able to change a location's parent from its detail view (a
  "Move to…" picker), subject to the cycle-prevention in FR3.3.
- FR5.5: The tree SHALL update immediately when a location is created, moved, or
  deleted — no manual refresh, consistent with every prior phase's reactivity contract.

### FR6 — Dashboard & Navigation Integration
- FR6.1: The Dashboard's "Locations" card SHALL become live, showing: total locations
  and a count of distinct location types in use.
- FR6.2: The sidebar SHALL gain a "Locations" navigation entry (Dashboard / Characters /
  Graph / Timeline / Canon / **Locations**).
- FR6.3: Dashboard Locations metrics SHALL update reactively on location
  create/move/delete.

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-3): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `location_details` table (with its
  self-referential FK) and new Rust/TS modules.
- NFR2 (Performance/Scalability posture): Hierarchy queries (children, ancestry chain)
  SHALL use indexed lookups on `parent_location_id`, consistent with the long-term
  target of the app remaining responsive at large data volumes (Phase 1 NFR2) — this
  phase is not tested at that scale, but must not choose an unindexed-scan approach.
- NFR3 (Reliability): Reparenting (on explicit move, or implicit on delete) SHALL be
  transactional and SHALL validate against cycles before committing, so a crash or a bad
  input can never leave the hierarchy in a state with a cycle or a dangling parent
  reference.

## Acceptance Criteria (Phase 4 "Done")

1. User can create a location (e.g. "Sol System") at root level, then create a child
   location ("Earth") under it, then a grandchild ("New Geneva"), and the tree reflects
   all three levels with zero explicit save action.
2. Opening "New Geneva" shows a breadcrumb "Sol System > Earth > New Geneva".
3. Deleting "Earth" leaves "New Geneva" in the tree, now reparented directly under "Sol
   System" (not orphaned, not deleted).
4. Attempting to move "Sol System" to become a child of "New Geneva" (its own
   descendant) is rejected.
5. Linking a character to "New Geneva" via `located_at` shows that character in New
   Geneva's detail view, and shows New Geneva in the character's own detail view.
6. Deleting a location removes it from the tree and the Dashboard's location count, and
   its `located_at` relationships are cleanly removed without affecting the linked
   characters/events.
7. Dashboard's Locations card shows live, accurate total and type-breakdown counts.
8. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite all
   pass with no errors (same verification bar as Phases 1-3).
