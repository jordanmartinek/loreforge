# LoreForge AI — Phase 1 Implementation Tasks

- [x] 1. Scaffold project
  - [x] 1.1 Create Tauri v2 + React + TypeScript + Vite app skeleton
  - [x] 1.2 Add Tailwind CSS, base design tokens (dark theme), Inter font
  - [x] 1.3 Add TanStack Query, TanStack Virtual, Zustand, react-force-graph-2d
  - [x] 1.4 Set up routing (Dashboard / Characters / Graph) and app shell (sidebar + top bar)

- [x] 2. Database layer (Rust)
  - [x] 2.1 Add `rusqlite` + bundled SQLite, connection setup in `app_data_dir()`
  - [x] 2.2 Write migration for `entities`, `relationships`, `revisions`, `character_details`
  - [x] 2.3 Implement `revisions::record` helper
  - [x] 2.4 Implement transactional create/update/delete helpers with soft delete

- [x] 3. Character commands (Rust)
  - [x] 3.1 `create_character`, `update_character`, `delete_character`, `get_character`,
        `list_characters` (with search/filter params)
  - [x] 3.2 `create_relationship`, `update_relationship`, `delete_relationship`,
        `list_relationships`
  - [x] 3.3 `get_dashboard_metrics` command (counts by role/status/needs_development)

- [x] 4. Frontend data layer
  - [x] 4.1 `lib/tauri.ts` typed invoke wrappers matching Rust DTOs (+ `lib/api.ts`
        auto-switch to an in-memory mock backend when not running inside Tauri,
        needed to develop/verify the UI in this sandbox)
  - [x] 4.2 TanStack Query hooks: `useCharacters`, `useCharacter`, `useAllRelationships`,
        `useRelationshipsForEntity`, `useDashboardMetrics`, with mutation hooks that
        invalidate related queries
  - [x] 4.3 `saveStatusStore` (zustand) + `useAutosaveField` debounced-save hook
  - [x] 4.4 `SaveStatusIndicator` component wired into top bar

- [x] 5. Universe Dashboard
  - [x] 5.1 `MetricCard` component
  - [x] 5.2 Dashboard grid: Characters (live), Universe Graph (live), 17 other modules
        as "Coming Soon" placeholders
  - [x] 5.3 Verified counts update live after creating/deleting a character (automated test)

- [x] 6. Characters module
  - [x] 6.1 Virtualized character list with search + role/status filters
  - [x] 6.2 Create/delete character flows (instant persistence, no save button)
  - [x] 6.3 Character detail dashboard: bio/appearance/goals/needs/flaws/secrets/
        psychology/dialogue style fields, all autosaving
  - [x] 6.4 Relationships panel on character detail: add/remove relationship inline

- [x] 7. Universe Graph
  - [x] 7.1 Build nodes/links selector from characters + relationships (`useGraphData`)
  - [x] 7.2 Render with react-force-graph-2d; color by role, size by degree
  - [x] 7.3 Hover tooltip, click-to-highlight neighborhood
  - [x] 7.4 Entity-type filter bar (character-only for now, extensible)
  - [x] 7.5 Confirmed graph data updates immediately on create/edit/delete (automated test)

- [x] 8. App shell polish
  - [x] 8.1 Dark/light theme toggle (default dark)
  - [x] 8.2 Sidebar navigation active states, Escape-to-close modals

- [x] 9. Verification
  - [x] 9.1 `cargo test`/`cargo check` for `loreforge-core` (pure Rust domain logic):
        10/10 tests pass, no warnings
  - [x] 9.2 `tsc -b` and `vite build` for the frontend: pass with no errors
  - [x] 9.3 Automated behavioral test suite (Vitest + Testing Library) covering
        Acceptance Criteria 1-6 end-to-end against the frontend: 13/13 pass
  - [ ] 9.4 `cargo check` for the `src-tauri` crate: **blocked in this sandbox**.
        Amazon Linux 2023 has no `webkit2gtk`/`libsoup-3.0` system packages
        available, which Tauri's Linux backend requires to link. The failure is
        confirmed to be purely a missing system library (occurs deep in
        transitive GTK/webkit sys-crates, before any of our own code compiles).
        `src-tauri` code is a thin, mechanical wrapper over the fully-tested
        `loreforge-core` crate; it should be verified with `cargo tauri dev` /
        `cargo check` on a real Linux (with webkit2gtk installed), macOS, or
        Windows machine, or in CI (see tauri.app Linux prerequisites).
