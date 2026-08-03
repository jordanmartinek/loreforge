# LoreForge AI — Phase 2: Timeline System — Design

## 1. Data Model

Follows the Phase 1 extensibility contract exactly: no changes to `entities`,
`relationships`, or `revisions`. One new detail table.

```sql
-- New in Phase 2 --------------------------------------------------

CREATE TABLE event_details (
  entity_id       TEXT PRIMARY KEY REFERENCES entities(id),
  description     TEXT NOT NULL DEFAULT '',
  layers_json     TEXT NOT NULL DEFAULT '[]',   -- e.g. ["historical","military"]
  start_date      TEXT NOT NULL,                -- ISO8601 date (YYYY-MM-DD); required
  end_date        TEXT,                         -- ISO8601 date; NULL = instantaneous event
  date_precision  TEXT NOT NULL DEFAULT 'day',  -- 'century' | 'decade' | 'year' | 'month' | 'day'
  significance    TEXT NOT NULL DEFAULT 'minor' -- 'major' | 'minor' (drives visual weight)
);
CREATE INDEX idx_event_details_start ON event_details(start_date);
```

Title lives on `entities.name` (reusing the existing column, same as Character). `entity_type
= 'event'` on the `entities` row. No new relationship_type table is needed:

```
relationships.relationship_type = 'participates_in'
relationships.source_entity_id  = <character entity id>
relationships.target_entity_id  = <event entity id>
```

This is the same table Phase 1 used for `friend`/`enemy`/`mentor`/etc. between two
characters — the schema was already generic enough (source/target are just entity ids,
not typed to "character"), so no migration to `relationships` is required. This is the
payoff of the Phase 1 design decision documented in design.md section 7.

`date_precision` exists because a worldbuilder often knows "this happened sometime in the
2140s" before they know the exact day. Storing a real `start_date` plus a precision flag
lets the UI round-display appropriately (e.g., show "2140s" at Decade zoom) while still
having a sortable, comparable date for every event — avoids a second nullable-date-parts
schema.

**Validation** (`end_date >= start_date` when both present) is enforced in
`loreforge-core::events::validate_date_range`, called from both `create` and `update`,
mirroring how Phase 1's `characters::create` validates non-empty names.

## 2. Backend (Rust) Structure

```
crates/loreforge-core/src/
  events.rs          - create/get/list/update/delete for events (mirrors characters.rs)
  models.rs           - + Event, NewEvent, EventPatch, EventFilter, TimelineMetrics DTOs
  dashboard.rs         - + timeline metrics query (extends existing get_metrics or a
                          new get_timeline_metrics, TBD at implementation time favoring
                          extending DashboardMetrics to avoid a second dashboard round-trip)
```

`events.rs` follows the exact same shape as `characters.rs`:
- `create(conn, NewEvent) -> Result<Event>` — validates non-empty name + date range,
  wraps insert into `entities` + `event_details` in `BEGIN IMMEDIATE`/`COMMIT`, records a
  `revisions` row.
- `get`, `list` (with `EventFilter { layer, search }`), `update` (partial patch, same
  macro-based field-update pattern as `characters::update`), `delete` (soft delete +
  cascades relationships exactly like `characters::delete`).

Reusing `relationships::create/list_for_entity/delete` as-is for `participates_in` links
— no new relationship code needed, only new call sites from the events/character UI.

`src-tauri/src/commands.rs` gains: `list_events`, `get_event`, `create_event`,
`update_event`, `delete_event` — same thin `#[tauri::command]` wrapper pattern as
Phase 1's character commands. `get_dashboard_metrics` is extended to include timeline
fields on the same `DashboardMetrics` struct (one round trip, avoids a second dashboard
query pattern class existing solely for one more card).

## 3. Frontend Structure

```
src/
  lib/
    types.ts            - + Event, NewEvent, EventPatch, EventFilter,
                           extend DashboardMetrics with timeline fields
    tauri.ts / api.ts    - + api.events.{list,get,create,update,delete}
    mockBackend.ts       - + mock event CRUD + participates_in relationships, same
                           in-memory pattern as characters/relationships
  hooks/
    useEvents.ts         - useEvents, useEvent, useCreateEvent, useUpdateEvent,
                           useDeleteEvent (mirrors useCharacters.ts exactly)
  components/
    timeline/
      TimelineView.tsx     - horizontal scroll/zoom canvas or virtualized track
      TimelineLayerFilter.tsx  - reuses the GraphFilters pattern (checkbox pills)
      EventCard.tsx          - a single event's visual block on the timeline
      EventDetailPanel.tsx   - create/edit event, reuses AutosaveField + a character
                               participant picker (reuses RelationshipEditor's
                               "connect to X" <Select> pattern, generalized slightly)
  pages/
    TimelinePage.tsx
```

### 3.1 Timeline rendering approach

Given NFR2 (scale toward 25k+ events without a rewrite) and the "no page-level scroll,
maximize usable space" design philosophy from Phase 1, Phase 2 renders the timeline as:

- A single horizontally-scrollable track per active layer (not a canvas/WebGL graph —
  events are discrete, labeled blocks, which reads better as styled DOM elements than as
  force-graph nodes).
- **Virtualized horizontally** using the date range and current zoom's pixels-per-day to
  compute which events fall in the visible viewport, rendering only those
  (`@tanstack/react-virtual`'s horizontal mode, already a Phase 1 dependency — no new
  library needed). This is the mechanism that keeps this approach viable at 25k+ events:
  we never render more DOM nodes than fit on screen.
- Zoom levels (Decade/Year/Month) are implemented as different "pixels per day" constants
  that rescale the virtualizer's item positions; changing zoom does not refetch data, it
  only recomputes layout (FR3.3, NFR2).
- Layers render as stacked horizontal lanes within the same scroll container, each lane
  toggled by `TimelineLayerFilter` (FR3.2).

### 3.2 Drag-to-reschedule

- Implemented with native pointer events on `EventCard` (pointerdown → track delta →
  pointerup), not a heavyweight DnD library — the interaction is one-dimensional
  (horizontal date shift) and doesn't need cross-container drop-target logic.
  - `pointerdown`: capture starting `start_date`/`end_date` and pointer x.
  - `pointermove`: compute delta-x → delta-days (using current zoom's pixels-per-day) →
    update local visual position only (no writes yet — satisfies FR4.3, "one revision per
    drag, not per pixel").
  - `pointerup`: commit the new dates via `useUpdateEvent` (same autosave mutation path
    as any other field), which produces exactly one revision-history entry and drives the
    save-status indicator through its normal saving → saved transition (FR4.1, reusing
    Phase 1's `saveStatusStore` — no new state machine).

### 3.3 Character integration

`CharacterDetail.tsx` gains a new `Section title="Timeline"` block that calls
`useRelationshipsForEntity(character.id)`, filters to `relationship_type ===
'participates_in'`, resolves the linked event via `useEvents()`, and renders them sorted
by `start_date`. This reuses 100% of Phase 1's relationship-fetching hook — no new data
hook required for this integration point (FR2.2).

## 4. Dashboard Integration

The existing `MetricCard` component (Phase 1) is reused as-is. `DashboardPage.tsx`'s
"Timeline" entry moves from the `COMING_SOON_CARDS` array into a live card, following the
exact same pattern as the Phase 1 Characters/Graph cards:

```tsx
<MetricCard
  title="Timeline"
  icon="⟿"
  to="/timeline"
  metrics={[
    { label: "Events", value: metrics?.events_total ?? 0 },
    { label: "Layers", value: metrics?.layers_in_use ?? 0 },
    { label: "Span", value: metrics?.date_span_label ?? "—" },
  ]}
/>
```

## 5. Extensibility Notes for Future Phases

- Scene/Chapter zoom levels: once Scene/Chapter entity types exist, they can slot into
  the same virtualized-track renderer as an additional "layer" — no timeline rendering
  rewrite needed, only a new entity type + participates_in-style relationship.
- "Historical Gaps" detection (mentioned in the original brief's Timeline card metrics):
  a future pass over `event_details.start_date` ordered by layer to find suspiciously
  large gaps — pure read-side logic over existing data, no schema change.
- AI Continuity Checker's "timeline contradictions" / "impossible travel times" checks
  will read the same `event_details` + `participates_in` relationships; Phase 2
  deliberately keeps event data fully structured (real dates, not just free text) so that
  future logic has something concrete to reason over.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no conflict/gap detection UI, no Scene/Chapter zoom, no
canon cross-referencing, no AI validation. The data model (`event_details` +
`participates_in`) is shaped so none of these require a schema migration when they arrive.
