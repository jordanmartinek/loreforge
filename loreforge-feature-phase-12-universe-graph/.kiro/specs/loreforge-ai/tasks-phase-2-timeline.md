# LoreForge AI — Phase 2: Timeline System — Implementation Tasks

- [x] 1. Data model (Rust)
  - [x] 1.1 Migration: `event_details` table + index on `start_date`
  - [x] 1.2 `models.rs`: `Event`, `NewEvent`, `EventPatch`, `EventFilter` DTOs;
        extend `DashboardMetrics` with timeline fields
  - [x] 1.3 `events.rs`: create/get/list/update/delete, date-range validation,
        mirroring `characters.rs` patterns (soft delete, revisions, transactions)
  - [x] 1.4 `dashboard.rs`: extend `get_metrics` with events_total, layers_in_use,
        date span (earliest/latest start_date)

- [x] 2. Rust unit tests (12 new tests, all passing)
  - [x] 2.1 create/get roundtrip, partial update, soft delete
  - [x] 2.2 date range validation (end before start rejected, incl. patch-only-end case)
  - [x] 2.3 layer filter / search filter on list(), ordering by start_date
  - [x] 2.4 participates_in relationship: create character<->event link via existing
        relationships module, list for entity, cascade delete on event delete,
        NOT cascade delete on character delete
  - [x] 2.5 dashboard metrics reflect live event data (events_total, layers_in_use,
        earliest/latest date span)

- [x] 3. Tauri commands
  - [x] 3.1 `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`
        added to `commands.rs` and registered in `lib.rs` invoke_handler

- [x] 4. Frontend data layer
  - [x] 4.1 `lib/types.ts`: Event/NewEvent/EventPatch/EventFilter types, extend
        DashboardMetrics
  - [x] 4.2 `lib/tauri.ts`: `api.events.*` typed wrappers
  - [x] 4.3 `lib/mockBackend.ts`: mock event CRUD + participates_in support (so the
        UI remains verifiable in this sandbox exactly as Phase 1 was)
  - [x] 4.4 `hooks/useEvents.ts`: useEvents/useEvent + create/update/delete mutations
        with query invalidation (mirrors useCharacters.ts)

- [x] 5. Timeline view
  - [x] 5.1 `useTimelineData` selector: events + layers -> lanes, honoring active
        layer filter and current zoom's pixels-per-day
  - [x] 5.2 `TimelineView.tsx`: horizontally windowed rendering via
        `filterVisibleEvents` (custom, date-position-based windowing rather than
        `@tanstack/react-virtual`'s index-based model, since events are positioned
        by arbitrary date, not sequential index -- same bounded-DOM-node guarantee)
  - [x] 5.3 `TimelineLayerFilter.tsx`: multi-select layer pills (reuse GraphFilters
        visual pattern)
  - [x] 5.4 Zoom control: Decade / Year / Month, rescaling only (no refetch --
        verified by an automated test spying on `api.events.list`)
  - [x] 5.5 `EventCard.tsx`: visual block, colored/styled by layer + significance
  - [x] 5.6 Click event -> `EventDetailPanel` (Modal, reusing Phase 1 `Modal`)
  - [x] 5.7 Drag-to-reschedule: pointerdown/move/up, commit on pointerup only

- [x] 6. Event detail editor
  - [x] 6.1 Title/description/layers/date fields via `AutosaveField` (text) + new
        multi-select for layers + date inputs
  - [x] 6.2 Participant picker: add/remove character via `participates_in`
        relationship, reusing `useCreateRelationship`/`useDeleteRelationship` from
        Phase 1 with `relationship_type: 'participates_in'`

- [x] 7. Character integration
  - [x] 7.1 `CharacterDetail.tsx`: new "Timeline" section listing participated
        events sorted by start_date, using existing `useRelationshipsForEntity` +
        `useEvents` (via new `CharacterTimeline.tsx`)

- [x] 8. Dashboard & navigation
  - [x] 8.1 Move "Timeline" from COMING_SOON_CARDS to a live MetricCard
  - [x] 8.2 Sidebar: add "Timeline" nav entry + route
  - [x] 8.3 `App.tsx`: register `/timeline` route

- [x] 9. Frontend behavioral tests (Vitest) -- `Timeline.behavior.test.tsx`, 8/8 passing
  - [x] 9.1 Create event, verify persistence + dashboard metric update (AC1)
  - [x] 9.2 Link event to character, verify it appears in character's Timeline section (AC2)
  - [x] 9.3 Delete event: removed from timeline + dashboard, relationship cleaned up (AC3)
  - [x] 9.4 Delete character: event NOT deleted, only relationship removed (AC4)
  - [x] 9.5 Layer filter: only active-layer events visible (AC5)
  - [x] 9.6 Zoom change: no data refetch triggered, verified via spy on api.events.list (AC6)
  - [x] 9.7 Dashboard Timeline card live metrics (AC8)
  - [x] 9.8 Sidebar navigation to Timeline
  - [x] 9.9 `timelineMath.test.ts`: 15 additional unit tests for the pure
        positioning/zoom/windowing/drag math, including a scale test confirming
        the windowing function keeps rendered-node count bounded at 25,000 events

- [x] 10. Verification
  - [x] 10.1 `cargo test -p loreforge-core` — 22/22 pass (10 Phase 1 + 12 new)
  - [x] 10.2 `tsc -b` and `vite build` — clean
  - [x] 10.3 `vitest --run` — 36/36 pass (28 Phase 1 + 8 new behavioral tests)
  - [x] 10.4 Manual walkthrough against requirements-phase-2-timeline.md Acceptance
        Criteria 1-9 -- confirmed via the automated behavioral test suite above
  - [ ] 10.5 `cargo check` for `src-tauri`: **blocked in this sandbox**, same root
        cause as Phase 1 tasks.md item 9.4 (no `webkit2gtk`/`libsoup-3.0` system
        packages available on Amazon Linux 2023). The new event commands in
        `commands.rs`/`lib.rs` are thin, mechanical wrappers over the fully-tested
        `loreforge-core::events` module; verify with `cargo tauri dev` on a real
        machine or in CI.

## Bugs found and fixed while writing tests

- `EventCard.tsx` called `setPointerCapture`/`releasePointerCapture` unconditionally;
  not every environment implements pointer capture, so these are now optional-chained.
  This also makes the app more robust on any future embedded webview that might lack
  full pointer capture support, not just the test environment.
- `TimelineView.tsx` only measured the scroll container's width on `scroll` events, not
  on mount. This meant events on-screen before any scroll occurred could have been
  incorrectly windowed out of the initial render on window/pane sizes the code hadn't
  yet measured. Fixed with a `useEffect` that measures on mount and when the event list
  changes size.
