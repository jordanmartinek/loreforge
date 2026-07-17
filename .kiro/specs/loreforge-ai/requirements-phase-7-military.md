# LoreForge AI — Phase 7: Military — Requirements

## Context

The original brief lists Military among the entity types a mature worldbuilding tool
needs. Phase 7 implements it as a new `military_unit` entity type: units/organizations
(a fleet, a legion, a company, a special-forces cell) arranged in a chain of command,
with a branch classification, doctrine notes, and links to the characters who serve in
them, the locations they're stationed at, and the technology they're equipped with.

### Structural precedent: this is Phase 6's shape again, with a third link type

Chain of command is, like biological taxonomy (Phase 6) and location containment
(Phase 4), a strict tree: a company reports to exactly one battalion, not two. It is not
a graph like Phase 5's technology dependencies. So this phase makes the same structural
choice Phase 6 made — Phase 4's tree *data model* (`parent_unit_id` column, chain-walk
cycle prevention, reparent-on-delete), Phase 5's flat-list *UI* (a unit is looked up by
name/branch, its place in the chain of command inspected from its own detail view, not
navigated as a tree).

What's new in this phase, relative to Phase 6, is the number of relationship types: a
military unit links to *three* other entity types (characters via `serves_in`, locations
via `stationed_at`, technology via `equipped_with`), not two. This is the first phase to
combine a tree taxonomy with three simultaneous relationship integration points, so it's
a test of whether the "one relationship-links component per linked type" pattern
(established in Phase 4-6) continues to scale cleanly as the number of link types grows,
or whether it needs to be generalized. This phase's design doc addresses that question
directly (see design-phase-7-military.md section 3.1).

## Phase 7 Scope

1. **Military unit entity type** — a new `military_unit_details` table: `branch` (fixed
   vocabulary: army | navy | air_force | space_force | marines | special_forces | militia
   | other), `doctrine` (free-text notes on tactics/philosophy/history), and a nullable
   `parent_unit_id` (self-referential, for chain of command — e.g. "3rd Company" reports
   to "1st Battalion").
2. **Chain of command tree** — a unit can have at most one parent unit (a strict tree,
   like Phase 4's locations and Phase 6's species, not a DAG like Phase 5's
   technologies). Cycle prevention and reparent-on-delete both reuse the same
   chain-walk logic already established in `locations.rs` and `species.rs`, generalized
   to `military.rs`.
3. **`serves_in` relationship** — a character can be linked to the unit they serve in
   (source = character, target = military unit), reusing the `relationships` table.
4. **`stationed_at` relationship** — a military unit can be linked to the location it's
   stationed at (source = military unit, target = location).
5. **`equipped_with` relationship** — a military unit can be linked to the technology
   it's equipped with (source = military unit, target = technology).
6. **Military UI** — a flat, filterable list (by branch) like
   Characters/Events/Canon/Technology/Species, not a tree like Locations, per the
   Context section. A unit's detail view shows its parent unit (if any), its direct
   subordinate units (read-only list, the reverse direction), its serving characters,
   its stationed location(s), and its equipped technology.
7. **Dashboard integration** — the existing "Ships" / general Coming Soon slate stays as
   is except for Military itself: the "Military" Coming Soon card becomes live, showing
   total units and a breakdown by branch.

### Explicitly Out of Scope for Phase 7

A chain-of-command tree-navigation UI (no tree component is built, consistent with
Phase 6's decision not to reuse World Explorer's tree UI); rank/personnel-count tracking
per unit (numeric strength figures belong with the future Universe Health Dashboard, not
this phase); unit-to-unit relationships beyond the chain of command (e.g. "allied with" /
"at war with" another unit — this belongs to the future Politics phase once that entity
type exists, mirroring Phase 6's decision to leave species-to-species conflict out of
scope); combat/battle event modeling (a unit's participation in a specific Timeline event
is possible today via the existing generic `relationships` table with a
timeline-event target, exactly like a character's participation, but no new
battle-specific relationship type or UI is built this phase — it would duplicate what
Timeline's existing `participates_in` pattern already covers generically); Ships as a
distinct entity type (a separate future phase per the original brief's list — a unit's
technology may happen to be a ship-type technology entity, but a "Ships" module with its
own hull/class/fleet-roster fields is out of scope here).

## Functional Requirements

### FR1 — Military Unit Entity & Chain-of-Command Data Model
- FR1.1: The system SHALL store military units as `entities` rows with
  `entity_type = 'military_unit'`, plus a `military_unit_details` row per unit (name
  lives on `entities.name`, as with every prior entity type).
- FR1.2: Each unit SHALL support: `branch` (fixed vocabulary, see Phase 7 Scope item 1),
  `doctrine` (free-text description), and an optional `parent_unit_id` referencing
  another unit's entity id.
- FR1.3: A unit SHALL NOT be able to become its own ancestor (setting a unit's parent to
  itself, or to one of its own descendants, must be rejected) — identical
  cycle-prevention contract to Phase 4 FR1.3 / Phase 6 FR1.3.
- FR1.4: Military units SHALL support soft delete and full revision history, identical
  to every prior entity type.

### FR2 — Chain-of-Command Queries
- FR2.1: The system SHALL be able to list the direct subordinate units of a given unit
  (or of the root, i.e. units with `parent_unit_id IS NULL`).
- FR2.2: A unit's detail view SHALL show its parent unit (if any) by name, and its direct
  subordinate units (read-only list, FR2.1's result for this unit).

### FR3 — Deletion & Reparenting
- FR3.1: Deleting a unit SHALL reparent its direct subordinate units to the deleted
  unit's own parent (or to root if it had none), so no subordinate unit is lost —
  identical reparent-on-delete contract to Phase 4 FR3.1 / Phase 6 FR3.1.
- FR3.2: Deleting a unit SHALL cascade soft-delete any `relationships` touching it
  (`serves_in`, `stationed_at`, and `equipped_with` links), without affecting the
  characters/locations/technology on the other end — consistent with every prior
  phase's cascade contract.
- FR3.3: Reparenting (changing a unit's `parent_unit_id`) SHALL be rejected if the new
  parent is the unit itself or one of its own descendants (same cycle-prevention as
  FR1.3).

### FR4 — `serves_in`, `stationed_at`, and `equipped_with` Relationships
- FR4.1: Users SHALL be able to link a character to a military unit via a `serves_in`
  relationship (source = character, target = military unit).
- FR4.2: Users SHALL be able to link a military unit to a location via a `stationed_at`
  relationship (source = military unit, target = location).
- FR4.3: Users SHALL be able to link a military unit to a technology via an
  `equipped_with` relationship (source = military unit, target = technology).
- FR4.4: A unit's detail view SHALL show which characters are linked to it via
  `serves_in`, which location(s) via `stationed_at`, and which technology via
  `equipped_with`, and allow adding/removing all three kinds of links.
- FR4.5: A character's detail view SHALL show its linked unit (if any); a location's
  detail view SHALL show the units stationed there; a technology's detail view SHALL
  show the units equipped with it — symmetric visibility on all three sides, consistent
  with every prior phase's reciprocal-link pattern (Phase 4 FR4.4, Phase 5 FR3.3, Phase 6
  FR4.4).

### FR5 — Military UI
- FR5.1: The primary Military view SHALL be a filterable, virtualized list (by branch
  and search), consistent with every prior flat-list entity type — NOT a tree, unlike
  Locations (per the Context section's design decision).
- FR5.2: Users SHALL be able to create, edit, and delete military units, with autosave
  (no explicit save action) on every field.
- FR5.3: The unit detail view SHALL show and allow editing of: branch, doctrine, parent
  unit (a "Set parent unit…" picker, subject to the cycle-prevention in FR3.3),
  subordinate units (FR2.2, read-only), serving characters, stationed location(s), and
  equipped technology (all three per FR4.4).
- FR5.4: The Military view SHALL update immediately when a unit or any of its
  relationships is created, edited, or deleted — no manual refresh, consistent with
  every prior phase's reactivity contract.

### FR6 — Dashboard & Navigation Integration
- FR6.1: The Dashboard's "Military" card SHALL become live, showing: total units and a
  count of distinct branches in use.
- FR6.2: The sidebar SHALL gain a "Military" navigation entry (Dashboard / Characters /
  Graph / Timeline / Canon / Locations / Technology / Species / **Military**).
- FR6.3: Dashboard Military metrics SHALL update reactively on unit create/delete.

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-6): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `military_unit_details` table (with its
  self-referential FK) and new Rust/TS modules.
- NFR2 (Reliability): Reparenting (on explicit update, or implicit on delete) SHALL be
  transactional and SHALL validate against cycles before committing — identical contract
  to Phase 4 NFR2 / Phase 6 NFR2.
- NFR3 (Performance posture): Chain-of-command queries (subordinate-unit list, cycle
  check) SHALL use indexed lookups on `parent_unit_id`, consistent with the long-term
  scalability target from Phase 1 NFR2.

## Acceptance Criteria (Phase 7 "Done")

1. User can create a military unit (e.g. "1st Battalion") with a branch and doctrine
   notes, persisting with zero explicit save action.
2. User can create a second unit ("3rd Company") and set its parent unit to "1st
   Battalion"; 3rd Company's detail view shows "1st Battalion" as its parent, and 1st
   Battalion's detail view shows "3rd Company" as a subordinate unit.
3. Attempting to set "1st Battalion" 's parent to "3rd Company" (its own descendant) is
   rejected.
4. Deleting "1st Battalion" (which has "3rd Company" as a subordinate) leaves 3rd
   Company in the list, now with no parent (reparented to root, not orphaned or
   deleted).
5. Linking a character to a unit via `serves_in` shows that character on the unit's
   detail view, and shows the unit on the character's own detail view.
6. Linking a unit to a location via `stationed_at` shows that location on the unit's
   detail view, and shows the unit on the location's own detail view.
7. Linking a unit to a technology via `equipped_with` shows that technology on the
   unit's detail view, and shows the unit on the technology's own detail view.
8. Deleting a unit removes it from the list and the Dashboard's unit count; its
   `serves_in`, `stationed_at`, and `equipped_with` relationships are cleanly removed
   without affecting the characters/locations/technology on the other end.
9. Dashboard's Military card shows live, accurate total and branch-breakdown counts.
10. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite
    all pass with no errors (same verification bar as Phases 1-6).
