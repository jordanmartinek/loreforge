# LoreForge AI — Phase 8: Politics — Requirements

## Context

The original brief lists Politics among the entity types a mature worldbuilding tool
needs. Phase 8 implements it as a new `political_entity` entity type: governments,
parties, factions, alliances, and guilds, with an ideology, an optional founding date,
a leader, controlled territory, and — new to this phase — diplomatic relationships
*between* political entities themselves.

### What's structurally new in this phase: symmetric relationships

Every relationship type introduced so far (`participates_in`, `depends_on`,
`relates_to`, `located_at`, `requires`, `uses_technology`, `member_of`, `native_to`,
`serves_in`, `stationed_at`, `equipped_with`) is directional in a meaningful way: the
source and target play different roles (a character *participates in* an event; a
technology *requires* another technology that is conceptually "more foundational").
Even Phase 5's `requires` graph, despite allowing multiple edges per node, still
distinguishes "dependent" from "prerequisite."

Diplomatic relationships between political entities are not like this. "The Meridian
Concord is allied with the Void Collective" and "the Void Collective is allied with the
Meridian Concord" are the same fact, not two facts about different roles. This phase
introduces the app's first **symmetric** relationship types: `allied_with` and
`rival_of`. Because the underlying `relationships` table still stores every row with a
`source_entity_id`/`target_entity_id` pair, "symmetric" has to be enforced at the
application layer: creating an edge must check both directions before inserting (so
"A allied with B" and "B allied with A" don't become two separate, duplicate rows), and
querying a political entity's allies must look at both directions too. This phase's
design doc (section 1.1) covers exactly how that's implemented, and why it's kept as a
dedicated `politics.rs` helper rather than a change to the generic `relationships`
module — the same "keep the generic module type-agnostic" principle Phase 5 established
for `requires`.

A second, smaller new rule this phase introduces: a pair of political entities cannot be
simultaneously `allied_with` and `rival_of` each other. Attempting to create one when the
other already exists between the same pair is rejected, the same way Phase 5/6/7 reject
cycle-creating edges — a business-rule validation that runs before the write, in the same
transaction.

## Phase 8 Scope

1. **Political entity type** — a new `political_entity_details` table: `classification`
   (fixed vocabulary: government | political_party | faction | alliance | guild | other),
   `ideology` (free-text notes), and an optional `founded_date` + `date_precision` for
   timeline placement (mirrors Phase 5 Technology's `introduced_date`/`date_precision`
   pattern).
2. **`leads` relationship** — a character can be linked to the political entity they
   lead (source = character, target = political entity), reusing the `relationships`
   table. Structurally identical to Phase 6's `member_of` and Phase 7's `serves_in`.
3. **`controls` relationship** — a political entity can be linked to the location(s) it
   controls as territory (source = political entity, target = location). Structurally
   identical to Phase 6's `native_to` and Phase 7's `stationed_at`.
4. **`allied_with` / `rival_of` relationships (new pattern)** — symmetric relationships
   between two political entities. Creating either type checks for an existing edge in
   either direction (no duplicates) and rejects creating one type where the other already
   exists between the same pair (mutual exclusivity).
5. **Politics UI** — a flat, filterable list (by classification) like every prior
   flat-list entity type, not a tree — there is no hierarchy in this phase's data model
   (unlike Locations/Species/Military's chain-of-command-shaped phases). A political
   entity's detail view shows its leader, its controlled territory, and its allies and
   rivals (as two separate lists within one "Diplomatic Relations" section).
6. **Dashboard integration** — the existing "Politics" Coming Soon card becomes live,
   showing total political entities and a breakdown by classification.

### Explicitly Out of Scope for Phase 8

Multi-party government structures (a `political_entity` "contains" other
`political_entity`s, e.g. a party being part of a coalition) — this would need a
taxonomy-tree-shaped relationship the way Locations/Species/Military have, which this
phase's data does not clearly need yet (a government and a party under it can already be
modeled as two independent political entities without a parent/child link, if the
worldbuilder chooses); revisit if a future phase's brief calls for it explicitly.
Elections/succession/term-of-office tracking (a leader's tenure dates) — the `leads`
relationship is a simple current-state link, not a historical record; if term history
matters, `relationships` already has `created_at`/`updated_at` and the Revision History
panel already shows when a `leads` link was added or removed, which covers the "who led
this and when" question without new modeling. Laws/policy/legislation as a distinct
entity type — out of scope, belongs to a future phase if the brief calls for it.
Symmetric relationships between any other entity type (e.g. a `rival_of` between two
characters) — this phase scopes `allied_with`/`rival_of` to political entities only, since
that's the concrete case in front of it; the underlying helper is written generally
enough to extend if a future phase needs a symmetric relationship elsewhere (see
design-phase-8-politics.md section 1.1), but no other entity type gets one this phase.

## Functional Requirements

### FR1 — Political Entity Data Model
- FR1.1: The system SHALL store political entities as `entities` rows with
  `entity_type = 'political_entity'`, plus a `political_entity_details` row per entity
  (name lives on `entities.name`, as with every prior entity type).
- FR1.2: Each political entity SHALL support: `classification` (fixed vocabulary, see
  Phase 8 Scope item 1), `ideology` (free-text description), and an optional
  `founded_date` + `date_precision`.
- FR1.3: Political entities SHALL support soft delete and full revision history,
  identical to every prior entity type.

### FR2 — `leads` and `controls` Relationships
- FR2.1: Users SHALL be able to link a character to the political entity they lead via a
  `leads` relationship (source = character, target = political entity).
- FR2.2: Users SHALL be able to link a political entity to a location it controls via a
  `controls` relationship (source = political entity, target = location).
- FR2.3: A political entity's detail view SHALL show its leader (if any) and its
  controlled territory, and allow adding/removing both kinds of links.
- FR2.4: A character's detail view SHALL show the political entity they lead (if any); a
  location's detail view SHALL show the political entities that control it — symmetric
  visibility, consistent with every prior phase's reciprocal-link pattern.

### FR3 — `allied_with` / `rival_of` Symmetric Relationships
- FR3.1: Users SHALL be able to mark two political entities as allied (`allied_with`) or
  rivals (`rival_of`).
- FR3.2: Creating an `allied_with` or `rival_of` edge SHALL be rejected if an edge of
  that same type already exists between the same pair, in either direction (no
  duplicate edges).
- FR3.3: Creating an `allied_with` edge SHALL be rejected if a `rival_of` edge already
  exists between the same pair (and vice versa) — a pair cannot be simultaneously allied
  and rival.
- FR3.4: A political entity's detail view SHALL show its allies and its rivals as two
  separate lists, resolved correctly regardless of which side of the underlying
  relationship row the entity happens to be on.
- FR3.5: A political entity SHALL NOT be able to be marked as its own ally or rival
  (self-link rejection, consistent with the generic `relationships::create` self-link
  guard already in place since Phase 1).
- FR3.6: Removing an `allied_with` or `rival_of` link SHALL remove it regardless of which
  side initiated the removal (there is exactly one underlying row per pair per
  relationship type, per FR3.2).

### FR4 — Deletion Cascade
- FR4.1: Deleting a political entity SHALL cascade soft-delete any `relationships`
  touching it (`leads`, `controls`, `allied_with`, `rival_of`), without affecting the
  characters/locations/other political entities on the other end — consistent with
  every prior phase's cascade contract.

### FR5 — Politics UI
- FR5.1: The primary Politics view SHALL be a filterable, virtualized list (by
  classification and search), consistent with every prior flat-list entity type.
- FR5.2: Users SHALL be able to create, edit, and delete political entities, with
  autosave (no explicit save action) on every field.
- FR5.3: The political entity detail view SHALL show and allow editing of:
  classification, ideology, founded date + precision, leader (FR2.3), controlled
  territory (FR2.3), and a "Diplomatic Relations" section showing allies and rivals
  (FR3.4) with the ability to add either kind of link and to see FR3.3's rejection
  surfaced clearly if attempted against an existing opposite-type link.
- FR5.4: The Politics view SHALL update immediately when a political entity or any of
  its relationships is created, edited, or deleted — no manual refresh, consistent with
  every prior phase's reactivity contract.

### FR6 — Dashboard & Navigation Integration
- FR6.1: The Dashboard's "Politics" card SHALL become live, showing: total political
  entities and a count of distinct classifications in use.
- FR6.2: The sidebar SHALL gain a "Politics" navigation entry.
- FR6.3: Dashboard Politics metrics SHALL update reactively on political entity
  create/delete.

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-7): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `political_entity_details` table and new
  Rust/TS modules.
- NFR2 (Reliability): Symmetric-edge creation and its mutual-exclusivity check (FR3.2,
  FR3.3) SHALL be transactional — validated before any write commits, identical
  transactional posture to every prior phase's cycle/business-rule checks.
- NFR3 (Correctness of the new symmetric pattern): The symmetric-edge helper SHALL be
  covered by tests proving that (a) querying either entity in a pair returns the same
  resolved "other side," and (b) attempting the reverse-direction duplicate is rejected
  the same way the same-direction duplicate is.

## Acceptance Criteria (Phase 8 "Done")

1. User can create a political entity (e.g. "Meridian Concord") with a classification
   and ideology notes, persisting with zero explicit save action.
2. Linking a character to a political entity via `leads` shows that character as the
   entity's leader, and shows the entity on the character's own detail view.
3. Linking a political entity to a location via `controls` shows that location as
   controlled territory, and shows the political entity on the location's own detail
   view.
4. Marking two political entities as `allied_with` shows each as the other's ally,
   symmetrically, regardless of which one initiated the link.
5. Attempting to mark the same pair as allied a second time (in either direction) is
   rejected as a duplicate.
6. Attempting to mark a pair as `rival_of` when they are already `allied_with` (or vice
   versa) is rejected.
7. Removing an alliance or rivalry link removes it from both entities' views.
8. Deleting a political entity removes it from the list and the Dashboard's count; its
   `leads`, `controls`, `allied_with`, and `rival_of` relationships are cleanly removed
   without affecting the characters/locations/other political entities on the other end.
9. Dashboard's Politics card shows live, accurate total and classification-breakdown
   counts.
10. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite
    all pass with no errors (same verification bar as Phases 1-7).
