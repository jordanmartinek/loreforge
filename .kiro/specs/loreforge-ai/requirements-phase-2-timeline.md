# LoreForge AI — Phase 2: Timeline System — Requirements

## Context

Phase 1 delivered the core entity/relationship/revision spine, the Universe Dashboard,
the Characters module, and the Universe Graph. Phase 2 adds the **Timeline System** from
the original brief: a multi-layer, multi-zoom, interactive timeline of events that
connects to characters and (in future phases) locations, technology, wars, etc.

Per the Phase 1 design doc (section 7, "Extensibility Path"): "Timeline (Phase 2) →
events are just another entity type with a `start_at`/`end_at` on its detail table;
timeline UI queries entities of type `event` ordered by date." This phase implements
exactly that, reusing the existing `entities`, `relationships`, and `revisions` tables
without modification.

## Phase 2 Scope

1. **Event entity type** — a new `event_details` table (alongside `character_details`),
   full CRUD, following the same soft-delete + revision-history pattern as Characters.
2. **Multi-layer classification** — every event belongs to one or more layers
   (Historical, Political, Military, Technology, Character Life, Wars, Books,
   Screenplays — per the original brief), so the timeline view can filter by layer.
3. **Character participation** — events link to characters via the existing
   `relationships` table using a new `relationship_type` value (`participates_in`),
   not a new join table. Reuses FR1.2 from Phase 1 rather than inventing new plumbing.
4. **Timeline view** — an interactive, horizontally-scrollable, zoomable timeline
   (Century → Decade → Year → Month → Day granularity for Phase 2; Scene/Chapter zoom
   deferred to when Scenes/Chapters exist as entity types).
5. **Drag-to-reschedule** — dragging an event on the timeline updates its date fields
   immediately (autosave, no save button — consistent with Phase 1 FR2).
6. **Dashboard integration** — the existing "Timeline" Coming Soon card becomes live,
   with real metrics (Events, layers represented, date range span).
7. **Character detail integration** — a character's detail view gains a "Timeline"
   section listing events they participate in, chronologically.

### Explicitly Out of Scope for Phase 2

Historical Gaps / conflict detection (requires cross-referencing canon/mysteries, not
yet built), Scene/Chapter zoom levels (no Scene/Chapter entities yet), AI Continuity
Checker integration, timeline-driven "impossible travel time" validation, Canon
management. These remain future-phase items; this phase's data model must not block them
(see design.md Extensibility Path).

## Functional Requirements

### FR1 — Event Entity & Data Model
- FR1.1: The system SHALL store events as `entities` rows with `entity_type = 'event'`,
  plus an `event_details` row per event (title lives on `entities.name`; everything else
  is event-specific).
- FR1.2: Each event SHALL support: description, one or more layers (multi-select),
  `start_date` (required), `end_date` (optional, for events with duration), an
  approximate/precise date-precision flag (to support "Century" vs "Day" granularity
  before an exact date is known), and an importance/significance flag.
- FR1.3: Events SHALL support soft delete and full revision history, identical to
  Characters in Phase 1 (FR1.3/FR1.4 from Phase 1 requirements, unchanged).
- FR1.4: An event's date range SHALL be validatable (end_date, if present, must not
  precede start_date) at write time.

### FR2 — Character Participation
- FR2.1: Users SHALL be able to link any event to any character via a
  `participates_in` relationship (reusing the Phase 1 `relationships` table — source
  = character entity, target = event entity, `relationship_type = 'participates_in'`).
- FR2.2: A character's detail view SHALL show a chronological list of events they
  participate in, computed via the same relationship query pattern as Phase 1's
  `RelationshipEditor` (no new relationship-fetching abstraction).
- FR2.3: Deleting an event SHALL cascade soft-delete its participation relationships
  (identical cascade behavior to Phase 1 character deletion, FR1.4).
- FR2.4: Deleting a character SHALL NOT delete events they participated in (only the
  participation relationship is removed) — events are shared story facts, not owned by
  any single character.

### FR3 — Multi-Layer Timeline View
- FR3.1: The Timeline page SHALL render events positioned along a horizontal time axis
  ordered by `start_date`.
- FR3.2: The Timeline SHALL support filtering by layer (Historical, Political,
  Military, Technology, Character Life, Wars, Books, Screenplays), with multiple layers
  active simultaneously, following the same extensible-filter-bar pattern as the
  Universe Graph's entity-type filter (Phase 1 FR5.4).
- FR3.3: The Timeline SHALL support at minimum three zoom levels for Phase 2: Decade,
  Year, and Month (Century/Day/Scene/Chapter deferred — see Out of Scope). Zooming SHALL
  rescale the visible time axis, not reload data.
- FR3.4: Events SHALL be visually distinguished by layer (e.g., color or lane) so a
  densely-populated timeline remains readable (ties to "never feel cluttered" design
  philosophy).
- FR3.5: Clicking an event SHALL open its detail editor (inline panel or modal,
  consistent with Phase 1's Modal component).
- FR3.6: The Timeline SHALL update immediately when an event is created, edited, or
  deleted — no manual refresh (same reactivity contract as Phase 1 FR5.5/FR3.4).

### FR4 — Drag-to-Reschedule
- FR4.1: Dragging an event along the time axis SHALL update its `start_date` (and
  `end_date`, preserving duration) via the autosave mechanism (Phase 1 FR2): no explicit
  save action, debounced write, save-status indicator reflects the change.
- FR4.2: Dragging SHALL respect the FR1.4 validation (end cannot precede start).
- FR4.3: A drag operation SHALL be a single revision-history entry (not one per pixel of
  movement) — the commit fires on drag-end, not on every mousemove.

### FR5 — Event Detail Editor
- FR5.1: Users SHALL be able to create, rename, edit, and delete events.
- FR5.2: Each event SHALL support autosaving fields for description and layer
  membership, following the same `AutosaveField` pattern as Characters (Phase 1 FR4.5).
- FR5.3: The event editor SHALL show and allow editing of participating characters
  (add/remove), mirroring the Character detail's `RelationshipEditor` in reverse.

### FR6 — Dashboard & Navigation Integration
- FR6.1: The Dashboard's "Timeline" card SHALL become live, showing: total events,
  number of distinct layers in use, and the earliest/latest event date span.
- FR6.2: The sidebar SHALL gain a "Timeline" navigation entry, following the existing
  pattern (Dashboard / Characters / Graph / **Timeline**).
- FR6.3: Dashboard Timeline metrics SHALL update reactively on event create/edit/delete
  (same contract as Phase 1 FR3.4).

## Non-Functional Requirements

- NFR1 (Consistency with Phase 1): No changes to the `entities`, `relationships`, or
  `revisions` table schemas. Only a new `event_details` table and new Rust/TS modules are
  added, per Phase 1 NFR5 (Extensibility).
- NFR2 (Performance): Timeline rendering SHALL remain responsive with hundreds of events
  in Phase 2 testing, using a virtualization/windowing approach suitable to scale toward
  the stated long-term target of 25,000+ events (Phase 1 NFR2) without a rewrite —
  Phase 2 does not need to be tested at that scale, but must not choose an approach that
  forecloses it (e.g., no "render every event as a DOM node with no windowing").
- NFR3 (Reliability): Drag-to-reschedule writes SHALL be transactional, consistent with
  Phase 1 NFR3.

## Acceptance Criteria (Phase 2 "Done")

1. User can create an event with a title, description, layer(s), and start date, and see
   it persist across a reload with zero explicit save action.
2. User can link an event to one or more characters; the character's detail view shows
   that event in its timeline section.
3. Deleting an event removes it from the Timeline view and the Dashboard's event count,
   and its participation relationships are cleanly removed (no orphan edges, no crashes).
4. Deleting a character does NOT delete events; the event remains, only the
   participation link is gone.
5. Filtering the Timeline by layer shows only events tagged with an active layer, with
   multiple layers combinable.
6. Zooming between Decade/Year/Month visibly rescales the timeline without a data
   reload/flicker.
7. Dragging an event to a new position updates its date and the change is reflected in
   the character detail view and Dashboard without manual refresh.
8. Dashboard "Timeline" card shows live, accurate metrics.
9. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite all
   pass with no errors (same verification bar as Phase 1, item 9 in tasks.md).
