# LoreForge AI — Phase 4: World Explorer (Locations) — Implementation Tasks

- [x] 1. Data model (Rust)
  - [x] 1.1 Migration: `location_details` table (self-referential `parent_location_id`)
        + index on `parent_location_id`
  - [x] 1.2 `models.rs`: `Location`, `NewLocation`, `LocationPatch`, `LocationFilter`
        DTOs; `LOCATION_TYPES`, `LOCATED_AT` consts; extend `DashboardMetrics` with
        locations_total / location_types_in_use
  - [x] 1.3 `locations.rs`: create/get/list/update/delete mirroring `canon.rs`'s shape
  - [x] 1.4 `locations.rs`: `list_children`, `get_ancestry_chain`, `would_create_cycle`
  - [x] 1.5 `locations.rs::update`: reject reparenting that would create a cycle
        (validated inside the same transaction as the write)
  - [x] 1.6 `locations.rs::delete`: reparent direct children to the deleted location's
        own parent (or root) in the same transaction as the soft delete + relationship
        cascade
  - [x] 1.7 `dashboard.rs`: extend `get_metrics` with locations_total /
        location_types_in_use

- [x] 2. Rust unit tests (14 new tests, all passing)
  - [x] 2.1 create/get roundtrip, partial update, soft delete (mirrors canon.rs tests)
  - [x] 2.2 list_children returns direct children only, including root (parent = NULL)
  - [x] 2.3 get_ancestry_chain returns immediate-parent-first ordering for a 3+ level
        hierarchy
  - [x] 2.4 creating/updating with a parent equal to self or a descendant is rejected
  - [x] 2.5 deleting a location reparents its children to its own parent, and to root
        when it had none
  - [x] 2.6 deleting a location cascades located_at relationships without touching the
        linked character/event
  - [x] 2.7 dashboard metrics reflect live location counts and type breakdown

- [x] 3. Tauri commands
  - [x] 3.1 `list_locations`, `get_location`, `create_location`, `update_location`,
        `delete_location`, `list_location_children`, `get_location_ancestry_chain`

- [x] 4. Frontend data layer
  - [x] 4.1 `lib/types.ts`: Location/NewLocation/LocationPatch/LocationFilter/
        LocationType types, extend DashboardMetrics
  - [x] 4.2 `lib/tauri.ts`: `api.locations.*`
  - [x] 4.3 `lib/mockBackend.ts`: mock location CRUD with the same reparent-on-delete
        and cycle-rejection guarantees as the real backend
  - [x] 4.4 `hooks/useLocations.ts`: useLocations/useLocation/useLocationChildren/
        useLocationAncestry + create/update/delete mutations

- [x] 5. World Explorer UI
  - [x] 5.1 `WorldExplorerTree.tsx`: root-level fetch + lazy per-node children fetch
  - [x] 5.2 `LocationTreeNode.tsx`: expand/collapse row, click to select
  - [x] 5.3 `LocationBreadcrumb.tsx`: renders ancestry chain (with an aria-label to
        disambiguate its `<nav>` landmark from the sidebar's)
  - [x] 5.4 `LocationDetail.tsx`: autosave description, location_type select, "Move
        to..." parent picker (client-side filters out self + descendants)
  - [x] 5.5 `LocationRelations.tsx`: located_at picker for characters/events
  - [x] 5.6 "+ Add Child Location" on LocationDetail creates a child of the currently
        selected location; "+ New" on the tree creates at root level

- [x] 6. Character/Event integration
  - [x] 6.1 `CharacterDetail.tsx`: show located_at location(s), if any (FR4.4), via new
        `EntityLocationLinks.tsx`
  - [x] 6.2 `EventDetailPanel.tsx`: show located_at location(s), if any (FR4.4)

- [x] 7. Dashboard & navigation
  - [x] 7.1 Move "Locations" from COMING_SOON_CARDS to a live MetricCard
  - [x] 7.2 Sidebar: add "World Explorer" nav entry + route
  - [x] 7.3 `App.tsx`: register `/locations` route

- [x] 8. Frontend behavioral tests (Vitest) -- `Locations.behavior.test.tsx`, 9/9 passing
  - [x] 8.1 Create a 3-level hierarchy (root > child > grandchild), tree reflects all
        three with zero explicit save action (AC1)
  - [x] 8.2 Breadcrumb shows the full ancestry chain (AC2)
  - [x] 8.3 Deleting a middle location reparents its child up one level, not deleted
        (AC3)
  - [x] 8.4 Moving a location to become a child of its own descendant is rejected (AC4)
  - [x] 8.5 The client-side "Move to" picker excludes the location's own descendants
  - [x] 8.6 Linking a character to a location shows up on both sides (AC5)
  - [x] 8.7 Deleting a location cleans up located_at relationships without touching the
        character/event (AC6)
  - [x] 8.8 Dashboard Locations card live counts (AC7)
  - [x] 8.9 Sidebar navigation to World Explorer

- [x] 9. Verification
  - [x] 9.1 `cargo test -p loreforge-core` — 51/51 pass (37 prior + 14 new)
  - [x] 9.2 `tsc -b` and `vite build` — clean
  - [x] 9.3 `vitest --run` — 60/60 pass (51 prior + 9 new behavioral tests)
  - [x] 9.4 Manual walkthrough against requirements-phase-4-locations.md Acceptance
        Criteria 1-7 -- confirmed via the automated behavioral test suite above
  - [ ] 9.5 `cargo check` for `src-tauri`: **blocked in this sandbox**, same root cause
        as Phases 1-3 (no `webkit2gtk`/`libsoup-3.0` system packages on Amazon Linux
        2023). The new location + hierarchy Tauri commands are thin, mechanical
        wrappers over the fully-tested `loreforge-core::locations` module; verify with
        `cargo tauri dev` on a real machine or in CI.

## Notable findings while implementing this phase

- Writing the ancestry-chain breadcrumb test surfaced that a plain `getByRole
  ("navigation")` query is ambiguous once a second `<nav>` landmark exists in the page
  (the sidebar is also a `<nav>`). Added `aria-label="Location breadcrumb"` to
  `LocationBreadcrumb.tsx` -- a genuine accessibility improvement (distinguishing
  landmarks for screen reader users), not just a test workaround.
- No production bugs were found in the reparent-on-delete or cycle-rejection logic
  itself; both the Rust and mock-backend implementations passed their respective test
  suites without needing fixes, which is a good sign that mirroring the design doc's
  algorithm description directly into both implementations kept them consistent.
