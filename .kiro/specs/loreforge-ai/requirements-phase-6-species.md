# LoreForge AI — Phase 6: Species Codex — Requirements

## Context

The original brief describes a Species Codex: sentient and non-sentient species/races,
with taxonomy (subspecies/variants), biology, and links to the characters who belong to
them and the locations they're native to. Phase 6 implements this as a new `species`
entity type.

The key structural question this phase has to settle, given the last two phases: is a
species' taxonomy a strict tree (Phase 4's `parent_location_id` pattern) or a general
graph (Phase 5's `requires` pattern)? Real-world biological taxonomy is a strict
tree — a subspecies has exactly one parent species/species-group ("Sub-Saharan Elari"
is a subspecies of "Elari," full stop; it does not also descend from "Vex-Kin"). This
phase follows Phase 4's pattern, not Phase 5's: a dedicated nullable
`parent_species_id` column, reusing Phase 4's chain-walk cycle prevention and
reparent-on-delete behavior directly, rather than Phase 5's graph-BFS machinery, which
would be solving a problem this data shape doesn't have.

Unlike Phase 4, though, the Species Codex is not primarily *navigated* as a tree the way
World Explorer is — a worldbuilder looks up a species by name or browses by
classification, then inspects its subspecies/parent-species from its own detail view.
So the taxonomy relationship reuses Phase 4's tree *data model and backend logic*, but
the UI reuses Phase 5's *flat list* pattern, not Phase 4's tree-navigation UI. This
combination — Phase 4's tree semantics, Phase 5's flat list surface — is deliberate and
is the central design decision of this phase.

## Phase 6 Scope

1. **Species entity type** — a new `species_details` table: classification (fixed
   vocabulary: sentient_humanoid | sentient_non_humanoid | non_sentient_fauna |
   non_sentient_flora | synthetic | hybrid | other), biology (free-text notes —
   physiology, lifespan, reproduction, etc.), and a nullable `parent_species_id`
   (self-referential, for subspecies/variants — e.g. "Sub-Saharan Elari" as a subspecies
   of "Elari").
2. **Taxonomy tree** — a species can have at most one parent species (a strict tree,
   like Phase 4's locations, not a DAG like Phase 5's technologies). Cycle prevention
   (a species cannot become its own ancestor) and reparent-on-delete (deleting a species
   reparents its direct subspecies to its own parent, or to root) both reuse Phase 4's
   `locations.rs` logic, generalized to `species.rs`.
3. **`member_of` relationship** — a character can be linked to the species they belong
   to (source = character, target = species), reusing the `relationships` table. A
   character can belong to more than one species is out of scope for this phase (see
   Explicitly Out of Scope) — `member_of` supports multiple links per character at the
   data-model level (nothing in `relationships` prevents it), but the UI in this phase
   treats "a character's species" as effectively single-valued for simplicity, same as
   how Phase 4's `located_at` doesn't prevent multiple links but the common case is one.
4. **`native_to` relationship** — a species can be linked to the location(s) it's
   native to (source = species, target = location), reusing the `relationships` table.
5. **Species Codex UI** — a flat, filterable list (by classification) like
   Characters/Events/Canon/Technology, not a tree like Locations, per the Context
   section's design decision. A species' detail view shows its parent species (if any)
   and its direct subspecies (read-only list, the reverse direction), plus its member
   characters and native locations.
6. **Dashboard integration** — the existing "Species" Coming Soon card becomes live,
   showing total species and a breakdown by classification.

### Explicitly Out of Scope for Phase 6

A species taxonomy tree-navigation UI (World Explorer's tree component is not reused —
per the Context section, a flat list is the primary surface for this phase, consistent
with Technology, not Locations); multi-species characters as a first-class concept
(a hybrid character with two species of origin — `member_of` is data-model-capable of
this since it's an ordinary relationship, but the UI in this phase doesn't build any
special hybrid-lineage affordance beyond "link this character to more than one species
if you want to"); population/demographics tracking (numeric population counts per
location, tied to the future Universe Health Dashboard, not this phase); species-level
relationship types beyond `member_of`/`native_to` (e.g. "at war with," a
species-to-species conflict relationship — this belongs to the future
Politics/Military phases once those entity types exist).

## Functional Requirements

### FR1 — Species Entity & Taxonomy Data Model
- FR1.1: The system SHALL store species as `entities` rows with
  `entity_type = 'species'`, plus a `species_details` row per species (name lives on
  `entities.name`, as with every prior entity type).
- FR1.2: Each species SHALL support: `classification` (fixed vocabulary, see Phase 6
  Scope item 1), `biology` (free-text description), and an optional
  `parent_species_id` referencing another species' entity id.
- FR1.3: A species SHALL NOT be able to become its own ancestor (setting a species'
  parent to itself, or to one of its own descendants, must be rejected) — identical
  cycle-prevention contract to Phase 4 FR1.3.
- FR1.4: Species SHALL support soft delete and full revision history, identical to
  every prior entity type.

### FR2 — Taxonomy Queries
- FR2.1: The system SHALL be able to list the direct subspecies of a given species (or
  of the root, i.e. species with `parent_species_id IS NULL`).
- FR2.2: A species' detail view SHALL show its parent species (if any) by name, and its
  direct subspecies (read-only list, FR2.1's result for this species).

### FR3 — Deletion & Reparenting
- FR3.1: Deleting a species SHALL reparent its direct subspecies to the deleted
  species' own parent (or to root if it had none), so no subspecies is lost — identical
  reparent-on-delete contract to Phase 4 FR3.1.
- FR3.2: Deleting a species SHALL cascade soft-delete any `relationships` touching it
  (`member_of` and `native_to` links), without affecting the characters/locations on the
  other end — consistent with every prior phase's cascade contract.
- FR3.3: Reparenting (changing a species' `parent_species_id`) SHALL be rejected if the
  new parent is the species itself or one of its own descendants (same cycle-prevention
  as FR1.3).

### FR4 — `member_of` and `native_to` Relationships
- FR4.1: Users SHALL be able to link a character to a species via a `member_of`
  relationship (source = character, target = species).
- FR4.2: Users SHALL be able to link a species to a location via a `native_to`
  relationship (source = species, target = location) representing "this species
  originates from / is commonly found at this location."
- FR4.3: A species' detail view SHALL show which characters are linked to it via
  `member_of`, and which locations are linked to it via `native_to`, and allow
  adding/removing both kinds of links.
- FR4.4: A character's detail view SHALL show its linked species (if any), and a
  location's detail view SHALL show its linked native species (if any) — symmetric
  visibility, consistent with Phase 4 FR4.4 and Phase 5 FR3.3's pattern.

### FR5 — Species Codex UI
- FR5.1: The primary Species view SHALL be a filterable, virtualized list (by
  classification and search), consistent with Characters/Events/Canon/Technology's list
  pattern — NOT a tree, unlike Locations (per the Context section's design decision).
- FR5.2: Users SHALL be able to create, edit, and delete species, with autosave (no
  explicit save action) on every field.
- FR5.3: The species detail view SHALL show and allow editing of: classification,
  biology, parent species (a "Set parent species…" picker, subject to the
  cycle-prevention in FR3.3), subspecies (FR2.2, read-only), member characters (FR4.3),
  and native locations (FR4.3).
- FR5.4: The Species Codex SHALL update immediately when a species or any of its
  relationships is created, edited, or deleted — no manual refresh, consistent with
  every prior phase's reactivity contract.

### FR6 — Dashboard & Navigation Integration
- FR6.1: The Dashboard's "Species" card SHALL become live, showing: total species and a
  count of distinct classifications in use.
- FR6.2: The sidebar SHALL gain a "Species Codex" navigation entry (Dashboard /
  Characters / Graph / Timeline / Canon / Locations / Technology / **Species**).
- FR6.3: Dashboard Species metrics SHALL update reactively on species create/delete.

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-5): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `species_details` table (with its
  self-referential FK) and new Rust/TS modules.
- NFR2 (Reliability): Reparenting (on explicit update, or implicit on delete) SHALL be
  transactional and SHALL validate against cycles before committing — identical
  contract to Phase 4 NFR3.
- NFR3 (Performance posture): Taxonomy queries (subspecies list, cycle check) SHALL use
  indexed lookups on `parent_species_id`, consistent with the long-term scalability
  target from Phase 1 NFR2.

## Acceptance Criteria (Phase 6 "Done")

1. User can create a species (e.g. "Elari") with a classification and biology notes,
   persisting with zero explicit save action.
2. User can create a second species ("Sub-Saharan Elari") and set its parent species to
   "Elari"; Sub-Saharan Elari's detail view shows "Elari" as its parent, and Elari's
   detail view shows "Sub-Saharan Elari" as a subspecies.
3. Attempting to set "Elari" 's parent to "Sub-Saharan Elari" (its own descendant) is
   rejected.
4. Deleting "Elari" (which has "Sub-Saharan Elari" as a subspecies) leaves Sub-Saharan
   Elari in the list, now with no parent (reparented to root, not orphaned or deleted).
5. Linking a character to a species via `member_of` shows that character on the
   species' detail view, and shows the species on the character's own detail view.
6. Linking a species to a location via `native_to` shows that location on the species'
   detail view, and shows the species on the location's own detail view.
7. Deleting a species removes it from the list and the Dashboard's species count; its
   `member_of` and `native_to` relationships are cleanly removed without affecting the
   characters/locations on the other end.
8. Dashboard's Species card shows live, accurate total and classification-breakdown
   counts.
9. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite
   all pass with no errors (same verification bar as Phases 1-5).
