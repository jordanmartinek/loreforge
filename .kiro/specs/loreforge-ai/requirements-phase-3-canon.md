# LoreForge AI — Phase 3: Canon Management — Requirements

## Context

Phase 1 built the core entity/relationship/revision spine and left the `revisions` table
fully populated (every character/event mutation already records one) but with **no UI
that ever reads from it**. Phase 2 added the Timeline System as the second entity type,
proving the extensibility contract holds. Phase 3 adds **Canon Management** from the
original brief, and — because canon is fundamentally "make this decision official and
never silently overwrite it" — also finally builds the **Version History** UI that reads
the revisions Phase 1 has been recording all along.

## Phase 3 Scope

1. **Canon entity type** — a new `canon_details` table (alongside `character_details` and
   `event_details`), full CRUD, same soft-delete + revision-history pattern.
2. **Canon status workflow** — Draft → Under Review → Approved, plus Deprecated (from any
   state), matching the original brief's Canon card metrics (Approved / Draft / Under
   Review / Deprecated).
3. **Dependencies** — a canon entry can depend on other canon entries, and can be related
   to characters and events, reusing the existing `relationships` table (two new
   relationship types: `depends_on` for canon-to-canon, `relates_to` for canon-to-anything
   else) — no new join tables.
4. **Version History UI** — a reusable revision-history panel that lists every recorded
   change for a given entity (timestamp, action, before/after snapshot), usable on
   Characters, Events, and Canon entries alike. This is the first UI in the app that reads
   the `revisions` table Phase 1 already writes to.
5. **Dashboard integration** — the existing "Canon" Coming Soon card becomes live, with
   real Approved / Draft / Under Review / Deprecated counts.

### Explicitly Out of Scope for Phase 3

Restoring a previous revision (read-only history browsing only, per FR-below), canon
conflict detection, AI-assisted canon suggestions, Project Snapshots (hourly/daily/before-
bulk-import restore points — a different, coarser-grained mechanism than per-entity
revision history), full diff visualization beyond a readable before/after summary. These
remain future-phase items and this phase's data model must not block them.

## Functional Requirements

### FR1 — Canon Entry Data Model
- FR1.1: The system SHALL store canon entries as `entities` rows with
  `entity_type = 'canon'`, plus a `canon_details` row per entry (title lives on
  `entities.name`, as with Character and Event).
- FR1.2: Each canon entry SHALL support: description, category (free-text, e.g. "Void
  Technology", "Political History"), status (`draft` | `under_review` | `approved` |
  `deprecated`), version (integer, auto-incremented on every content update), and notes.
- FR1.3: Canon entries SHALL support soft delete and full revision history, identical to
  Characters and Events in prior phases.
- FR1.4: Every content-changing update to a canon entry SHALL increment its `version`
  field by exactly 1, distinct from the revision-history log (version is a
  user-facing "this is the 4th official iteration of this decision" counter; revision
  history is the underlying technical change log).

### FR2 — Status Workflow
- FR2.1: A canon entry SHALL be creatable directly into `draft` status by default.
- FR2.2: Users SHALL be able to transition a canon entry's status among `draft`,
  `under_review`, `approved`, and `deprecated` in any direction (no enforced linear
  workflow in this phase — a worldbuilder may need to revert an approved entry to draft).
- FR2.3: Every status transition SHALL be recorded in revision history (it's a content
  change and increments version per FR1.4).

### FR3 — Dependencies & Relations
- FR3.1: A canon entry SHALL be able to depend on one or more other canon entries via a
  `depends_on` relationship (source = dependent entry, target = depended-upon entry).
- FR3.2: A canon entry SHALL be able to relate to characters and/or events via a
  `relates_to` relationship (either direction is acceptable since canon entries don't
  have a fixed "owning" side the way character-participates-in-event does).
- FR3.3: Deleting a canon entry SHALL cascade soft-delete its dependency/relation
  relationships without affecting the characters/events/other canon entries on the other
  end (same cascade contract as Phase 1 FR1.4 and Phase 2 FR2.4).

### FR4 — Version History UI
- FR4.1: Any entity with revision history (Character, Event, Canon Entry) SHALL expose a
  "History" affordance that opens a chronological list of its revisions.
- FR4.2: Each history entry SHALL show: action (create/update/delete), timestamp, and a
  human-readable summary of what changed (at minimum, which fields differed between
  before/after; a full diff viewer is out of scope for this phase).
- FR4.3: History SHALL be read-only in this phase (view only; no "restore this version"
  action — restoring is a larger feature involving conflict resolution with newer changes,
  deferred).
- FR4.4: The history panel SHALL be a single reusable component parameterized by entity
  id, not a per-entity-type reimplementation, so future entity types (Phase 4+) get
  history browsing for free.

### FR5 — Dashboard & Navigation Integration
- FR5.1: The Dashboard's "Canon" card SHALL become live, showing: Approved, Draft, Under
  Review, and Deprecated counts.
- FR5.2: The sidebar SHALL gain a "Canon" navigation entry (Dashboard / Characters / Graph
  / Timeline / **Canon**).
- FR5.3: Dashboard Canon metrics SHALL update reactively on canon entry create/status
  change/delete (same contract as prior phases).

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-2): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `canon_details` table and new Rust/TS modules.
- NFR2 (Reliability): Version increments and revision-history writes SHALL happen in the
  same transaction as the content update they document (no window where version could be
  bumped without a matching revision row, or vice versa).
- NFR3 (Performance): The revision-history panel SHALL page/limit its query rather than
  loading unbounded history for entities with very long change logs, consistent with the
  long-term scalability posture from Phase 1 NFR2.

## Acceptance Criteria (Phase 3 "Done")

1. User can create a canon entry with title, description, category, and see it default to
   Draft status, persisting with zero explicit save action.
2. User can transition a canon entry through Draft → Under Review → Approved → Deprecated
   (and back), each transition reflected immediately in the Dashboard's Canon card.
3. User can link a canon entry to another canon entry (depends_on) and to a character or
   event (relates_to); deleting the canon entry cleanly removes those links without
   affecting the other side.
4. Opening a canon entry's History panel shows every create/status-change/update action
   with timestamps, most recent first.
5. Opening a Character's or Event's History panel (existing entities from Phases 1-2)
   shows their full change history, proving the panel is genuinely reusable and not
   canon-specific.
6. Dashboard's Canon card shows live, accurate Approved/Draft/Under Review/Deprecated
   counts.
7. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite all
   pass with no errors (same verification bar as Phases 1-2).
