# LoreForge AI — Phase 5: Technology Bible — Requirements

## Context

The original brief describes a structured Technology Bible: ships, weapons, power
systems, communications, medical technology, artificial intelligence, void technology,
and military doctrine, each with dependencies and a timeline placement. Phase 5
implements this as a new `technology` entity type.

The key structural difference from every prior phase: a technology's dependencies form a
**directed acyclic graph (DAG)**, not a strict tree like Phase 4's location hierarchy. A
weapon system might depend on both a power system and a targeting AI; a void drive might
depend on void theory *and* be a prerequisite for three different ship classes. Because a
technology can have multiple prerequisites and multiple dependents, dependencies are
modeled as ordinary `relationships` rows (like Phase 3's canon `depends_on`), not a
single-parent column (like Phase 4's `parent_location_id`). Cycle prevention therefore
needs a general graph-cycle check (walk all outgoing dependency edges), not the
single-parent-chain walk Phase 4 used.

## Phase 5 Scope

1. **Technology entity type** — a new `technology_details` table: category (fixed
   vocabulary: ships | weapons | power_systems | communications | medical | artificial_intelligence
   | void_technology | military_doctrine | other), description, and a timeline placement
   (`introduced_date` + `date_precision`, reusing Phase 2's precision vocabulary so an
   undated "sometime in the 2140s" technology is still sortable).
2. **Dependency graph** — a technology can `requires` one or more other technologies
   (reusing the `relationships` table, source = dependent tech, target = prerequisite
   tech). Creating a `requires` edge that would introduce a cycle anywhere in the graph
   is rejected.
3. **Usage links** — characters, events, and locations can be linked to a technology via
   a `uses_technology` relationship (source = character/event/location, target =
   technology) — "this character uses this tech," "this event involves this tech," "this
   location has this tech installed."
4. **Technology Bible UI** — a flat, filterable list (by category) similar to
   Characters/Events/Canon, since a technology's *dependency graph* is the interesting
   structure (shown on its detail view), not a hierarchy of the technologies themselves
   the way Locations needed a tree as the primary navigation surface.
5. **Dashboard integration** — the existing "Technology" Coming Soon card becomes live,
   showing total technologies and a breakdown by category.

### Explicitly Out of Scope for Phase 5

A dedicated visual dependency-graph renderer (the Universe Graph from Phase 1 could
later be extended to show technology nodes/edges, but this phase only needs a readable
list-based view of a technology's direct prerequisites/dependents, not a new graph
canvas), automatic timeline-contradiction detection ("this event uses a technology that
hadn't been invented yet" — this is exactly the kind of check the future AI Continuity
Checker performs, and needs this phase's structured data to exist first, but the
checking logic itself is out of scope here), tech tree versioning/branching (alternate
timelines where a technology was invented differently — a single timeline placement per
technology is sufficient for this phase).

## Functional Requirements

### FR1 — Technology Entity Data Model
- FR1.1: The system SHALL store technologies as `entities` rows with
  `entity_type = 'technology'`, plus a `technology_details` row per technology (name
  lives on `entities.name`, as with every prior entity type).
- FR1.2: Each technology SHALL support: category (fixed vocabulary, see Phase 5 Scope
  item 1), description, `introduced_date` (optional — many technologies' origins are
  deliberately vague in-universe), and `date_precision` (century | decade | year | month
  | day, reusing Phase 2's vocabulary).
- FR1.3: Technologies SHALL support soft delete and full revision history, identical to
  every prior entity type.

### FR2 — Dependency Graph
- FR2.1: A technology SHALL be able to `requires` one or more other technologies via the
  existing `relationships` table (source = dependent, target = prerequisite).
- FR2.2: Creating a `requires` edge SHALL be rejected if it would introduce a cycle
  anywhere in the technology dependency graph (not just a direct back-reference — e.g. if
  A requires B and B requires C, creating "C requires A" must be rejected because it
  would close a cycle A→B→C→A).
- FR2.3: A technology's detail view SHALL show both its direct prerequisites (what it
  requires) and its direct dependents (what requires it) — the graph is useful to
  traverse in both directions.
- FR2.4: Deleting a technology SHALL cascade soft-delete any `requires` edges touching
  it (as either the dependent or the prerequisite side), without deleting the other
  technologies on those edges — consistent with every prior phase's cascade contract.

### FR3 — Usage Links
- FR3.1: Users SHALL be able to link a character, event, or location to a technology via
  a `uses_technology` relationship (source = character/event/location, target =
  technology).
- FR3.2: A technology's detail view SHALL show which characters, events, and locations
  are linked to it via `uses_technology`, and allow adding/removing those links.
- FR3.3: A character's, event's, or location's own detail view SHALL show its linked
  technologies, if any (symmetric visibility, consistent with Phase 4 FR4.4's pattern for
  `located_at`).

### FR4 — Technology Bible UI
- FR4.1: The primary Technology view SHALL be a filterable, virtualized list (by
  category and search), consistent with Characters/Events/Canon's list pattern.
- FR4.2: Users SHALL be able to create, edit, and delete technologies, with autosave
  (no explicit save action) on every field.
- FR4.3: The technology detail view SHALL show and allow editing of: category,
  description, introduced date + precision, prerequisites (FR2.3), dependents (FR2.3,
  read-only — dependents are established from the *other* technology's side), and usage
  links (FR3.2).
- FR4.4: The Technology Bible SHALL update immediately when a technology or dependency
  edge is created, edited, or deleted — no manual refresh, consistent with every prior
  phase's reactivity contract.

### FR5 — Dashboard & Navigation Integration
- FR5.1: The Dashboard's "Technology" card SHALL become live, showing: total
  technologies and a count of distinct categories in use.
- FR5.2: The sidebar SHALL gain a "Technology" navigation entry (Dashboard / Characters /
  Graph / Timeline / Canon / Locations / **Technology**).
- FR5.3: Dashboard Technology metrics SHALL update reactively on technology
  create/delete.

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-4): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `technology_details` table and new Rust/TS
  modules.
- NFR2 (Reliability): Cycle detection for `requires` edges SHALL run inside the same
  transaction as the edge's creation, so a crash or concurrent write can never leave the
  graph with an undetected cycle.
- NFR3 (Performance posture): Cycle detection SHALL be a bounded graph traversal (visited-set
  guarded, per Phase 4's `would_create_cycle` pattern generalized from a chain-walk to a
  graph-walk) rather than an unbounded or exponential check, consistent with the
  long-term scalability posture from Phase 1 NFR2.

## Acceptance Criteria (Phase 5 "Done")

1. User can create a technology (e.g. "Void Drive") with a category and description,
   persisting with zero explicit save action.
2. User can mark "Void Drive" as requiring "Void Theory" (another technology); Void
   Drive's detail view shows Void Theory as a prerequisite, and Void Theory's detail view
   shows Void Drive as a dependent.
3. Attempting to make "Void Theory" require "Void Drive" (which would close a cycle,
   since Void Drive already requires Void Theory) is rejected.
4. Attempting a longer indirect cycle (A requires B, B requires C, then C requires A) is
   also rejected.
5. Linking a character to a technology via `uses_technology` shows that character on the
   technology's detail view, and shows the technology on the character's own detail
   view.
6. Deleting a technology removes it from the list and the Dashboard's technology count;
   its `requires` edges and `uses_technology` links are cleanly removed without deleting
   the technologies/characters/events/locations on the other end.
7. Dashboard's Technology card shows live, accurate total and category-breakdown counts.
8. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite all
   pass with no errors (same verification bar as Phases 1-4).
