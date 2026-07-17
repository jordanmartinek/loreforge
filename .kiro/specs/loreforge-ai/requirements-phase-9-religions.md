# LoreForge AI — Phase 9: Religions — Requirements

## Context

The original brief lists Religions among the entity types a mature worldbuilding tool
needs. Phase 9 implements it as a new `religion` entity type: belief systems, faiths,
and cults, with a schism/denomination hierarchy, a classification, and links to the
characters who follow them and the locations that are holy sites.

### What's structurally new in this phase: nothing, and that's the point

A religion's denominational structure (a schism splits a faith into two, a
denomination is a variant of a parent tradition) is a strict tree, exactly like Phase
4's location containment, Phase 6's species taxonomy, and Phase 7's chain of command.
This is now the **fourth** entity type with this exact shape, and the third time the
single-parent chain-walk cycle-check and reparent-on-delete logic would otherwise be
copy-pasted nearly verbatim (`locations.rs` → `species.rs` → `military.rs`, each
differing only in table/column names).

Phase 7's design doc explicitly deferred extracting this into a shared helper,
reasoning that two real examples weren't enough to design a generic abstraction
against, and that a third might not clarify the shape either. It also said, in effect:
revisit this the next time a fourth tree-shaped entity type arrives, since three real
examples is enough to design against with confidence. Phase 9 is that fourth arrival.
This phase's main structural work is not Religions itself — that part is routine by now
— it's finally extracting `locations.rs`/`species.rs`/`military.rs`'s duplicated
chain-walk logic into a shared `hierarchy.rs` module, and having `religions.rs` be the
first consumer to use it from day one instead of writing a fourth near-identical copy.
See design-phase-9-religions.md section 1 for the extracted API's shape and section 1.2
for why *now* is the right time (and why Phase 5-8's other business rules — cycle
detection generalized to a graph, symmetric relationships — are *not* folded into this
same extraction, since they solve different problems).

## Phase 9 Scope

1. **Generic hierarchy helper (refactor, not new scope, but required before Religions
   can be built cleanly)** — extract a `hierarchy::would_create_cycle` function
   parameterized by "how do I look up a node's parent," and migrate
   `locations.rs`/`species.rs`/`military.rs` to call it instead of their own
   hand-written copies. This SHALL NOT change any observable behavior of Locations,
   Species, or Military — their existing test suites must continue to pass unmodified
   as a correctness check on the refactor.
2. **Religion entity type** — a new `religion_details` table: `classification` (fixed
   vocabulary: organized_religion | folk_tradition | cult | philosophy | pantheon_cult |
   other), `tenets` (free-text notes on core beliefs/practices), and a nullable
   `parent_religion_id` (self-referential, for schisms/denominations — e.g. "Reformed
   Solari Rite" as a denomination of "Solari Faith"), using the new `hierarchy.rs`
   helper for cycle prevention and reparent-on-delete.
3. **`follows` relationship** — a character can be linked to the religion they follow
   (source = character, target = religion), reusing the `relationships` table.
   Structurally identical to Phase 6's `member_of` / Phase 7's `serves_in` / Phase 8's
   `leads`.
4. **`holy_site` relationship** — a religion can be linked to the location(s) it
   considers a holy site (source = religion, target = location). Structurally identical
   to Phase 6's `native_to` / Phase 7's `stationed_at` / Phase 8's `controls`.
5. **Religions UI** — a flat, filterable list (by classification) like every prior
   flat-list entity type, not a tree — same design decision as Phases 6/7's "tree data
   model, flat navigation surface" split. A religion's detail view shows its parent
   religion (if any), its direct schisms/denominations (read-only list), its followers,
   and its holy sites.
6. **Dashboard integration** — the existing "Religions" Coming Soon card becomes live,
   showing total religions and a breakdown by classification. Per Phase 8's
   proactively-applied lesson, double-check `COMING_SOON_CARDS` for a stale "Religions"
   entry and remove it in the same change.

### Explicitly Out of Scope for Phase 9

A schism-tree-navigation UI (no tree component is built, consistent with Phases
6/7's decision); deity/pantheon-member entity modeling (a religion's individual gods or
saints as their own sub-entities) — out of scope; this phase treats a religion as one
entity with free-text `tenets`, not a structured pantheon; clergy/hierarchy-of-office
tracking within a single religion (e.g. "High Priest" vs. "Acolyte" ranks) — a
`follows` link is a simple current-state membership link, not a role or rank, mirroring
Phase 8's explicit non-scoping of elections/succession; religious conflict/schism-cause
modeling beyond the parent/child link itself (why a schism happened) — belongs to
free-text `tenets`/`description` fields, not new structured data this phase.

## Functional Requirements

### FR1 — Generic Hierarchy Helper (Refactor)
- FR1.1: The system SHALL provide a single `would_create_cycle` implementation in
  `hierarchy.rs`, parameterized so callers supply how to fetch a given node's current
  parent id.
- FR1.2: `locations.rs`, `species.rs`, and `military.rs` SHALL be refactored to call the
  shared helper instead of their own copies, with no change to their public function
  signatures or observable behavior.
- FR1.3: All existing Locations/Species/Military unit tests SHALL continue to pass
  unmodified after the refactor (this is the correctness proof for FR1.2).

### FR2 — Religion Entity & Schism Hierarchy Data Model
- FR2.1: The system SHALL store religions as `entities` rows with
  `entity_type = 'religion'`, plus a `religion_details` row per religion.
- FR2.2: Each religion SHALL support: `classification` (fixed vocabulary, see Phase 9
  Scope item 2), `tenets` (free-text description), and an optional
  `parent_religion_id`.
- FR2.3: A religion SHALL NOT be able to become its own ancestor (identical
  cycle-prevention contract to Phase 4/6/7, now implemented via the shared
  `hierarchy.rs` helper per FR1.1).
- FR2.4: Religions SHALL support soft delete and full revision history, identical to
  every prior entity type.

### FR3 — Schism Queries & Deletion
- FR3.1: The system SHALL be able to list the direct schisms/denominations of a given
  religion (or of the root, i.e. religions with `parent_religion_id IS NULL`).
- FR3.2: A religion's detail view SHALL show its parent religion (if any) by name, and
  its direct schisms (read-only list).
- FR3.3: Deleting a religion SHALL reparent its direct schisms to the deleted religion's
  own parent (or to root if it had none) — identical reparent-on-delete contract to
  Phase 4/6/7.
- FR3.4: Deleting a religion SHALL cascade soft-delete any `relationships` touching it
  (`follows` and `holy_site` links), without affecting the characters/locations on the
  other end.
- FR3.5: Reparenting (changing a religion's `parent_religion_id`) SHALL be rejected if
  the new parent is the religion itself or one of its own descendants.

### FR4 — `follows` and `holy_site` Relationships
- FR4.1: Users SHALL be able to link a character to a religion via a `follows`
  relationship (source = character, target = religion).
- FR4.2: Users SHALL be able to link a religion to a location via a `holy_site`
  relationship (source = religion, target = location).
- FR4.3: A religion's detail view SHALL show its followers and its holy sites, and
  allow adding/removing both kinds of links.
- FR4.4: A character's detail view SHALL show its followed religion (if any); a
  location's detail view SHALL show the religions that consider it a holy site —
  symmetric visibility, consistent with every prior phase's reciprocal-link pattern.

### FR5 — Religions UI
- FR5.1: The primary Religions view SHALL be a filterable, virtualized list (by
  classification and search), consistent with every prior flat-list entity type.
- FR5.2: Users SHALL be able to create, edit, and delete religions, with autosave (no
  explicit save action) on every field.
- FR5.3: The religion detail view SHALL show and allow editing of: classification,
  tenets, parent religion (a "Set parent religion…" picker, subject to FR2.3's
  cycle-prevention), schisms (FR3.2, read-only), followers, and holy sites (FR4.3).
- FR5.4: The Religions view SHALL update immediately when a religion or any of its
  relationships is created, edited, or deleted — no manual refresh.

### FR6 — Dashboard & Navigation Integration
- FR6.1: The Dashboard's "Religions" card SHALL become live, showing: total religions
  and a count of distinct classifications in use.
- FR6.2: The sidebar SHALL gain a "Religions" navigation entry.
- FR6.3: Dashboard Religions metrics SHALL update reactively on religion
  create/delete.

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-8): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `religion_details` table (with its
  self-referential FK), a new `hierarchy.rs` module, and new Rust/TS modules for
  Religions.
- NFR2 (Reliability): Reparenting SHALL be transactional and SHALL validate against
  cycles before committing, identical contract to Phase 4/6/7.
- NFR3 (Refactor safety): The `hierarchy.rs` extraction (FR1) SHALL be validated purely
  by the existing Locations/Species/Military test suites passing unmodified — no new
  tests are needed to prove the refactor itself is behavior-preserving, since those
  suites already fully specify the required behavior.

## Acceptance Criteria (Phase 9 "Done")

1. User can create a religion (e.g. "Solari Faith") with a classification and tenets,
   persisting with zero explicit save action.
2. User can create a second religion ("Reformed Solari Rite") and set its parent
   religion to "Solari Faith"; Reformed Solari Rite's detail view shows "Solari Faith"
   as its parent, and Solari Faith's detail view shows "Reformed Solari Rite" as a
   schism.
3. Attempting to set "Solari Faith" 's parent to "Reformed Solari Rite" (its own
   descendant) is rejected.
4. Deleting "Solari Faith" (which has "Reformed Solari Rite" as a schism) leaves
   Reformed Solari Rite in the list, now with no parent (reparented to root).
5. Linking a character to a religion via `follows` shows that character on the
   religion's detail view, and shows the religion on the character's own detail view.
6. Linking a religion to a location via `holy_site` shows that location on the
   religion's detail view, and shows the religion on the location's own detail view.
7. Deleting a religion removes it from the list and the Dashboard's count; its
   `follows` and `holy_site` relationships are cleanly removed without affecting the
   characters/locations on the other end.
8. Dashboard's Religions card shows live, accurate total and classification-breakdown
   counts.
9. After the `hierarchy.rs` extraction, every pre-existing Locations/Species/Military
   test still passes unmodified, proving the refactor changed no observable behavior.
10. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite
    all pass with no errors (same verification bar as Phases 1-8).
