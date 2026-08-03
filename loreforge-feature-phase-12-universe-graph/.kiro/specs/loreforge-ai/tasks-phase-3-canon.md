# LoreForge AI — Phase 3: Canon Management — Implementation Tasks

- [x] 1. Data model (Rust)
  - [x] 1.1 Migration: `canon_details` table + index on `status`
  - [x] 1.2 `models.rs`: `CanonEntry`, `NewCanonEntry`, `CanonEntryPatch`, `CanonFilter`,
        `RevisionEntry` DTOs; extend `DashboardMetrics` with canon status counts
  - [x] 1.3 `canon.rs`: create/get/list/update/delete, mirroring `events.rs`; `update`
        increments `version` in the same transaction as the content change
  - [x] 1.4 `revisions.rs`: add `list_for_record(conn, entity_id, limit)` read function
  - [x] 1.5 `dashboard.rs`: extend `get_metrics` with canon_approved/draft/under_review/
        deprecated counts

- [x] 2. Rust unit tests (15 new tests, all passing)
  - [x] 2.1 create/get roundtrip, partial update, soft delete (mirrors events.rs tests)
  - [x] 2.2 status transitions in any direction, each recorded as a revision
  - [x] 2.3 version increments by exactly 1 per content update, including status changes
  - [x] 2.4 depends_on (canon<->canon) and relates_to (canon<->character/event) via
        existing relationships module; cascade delete cleans up links without touching
        the other side
  - [x] 2.5 list_for_record returns revisions newest-first, respects limit
  - [x] 2.6 dashboard metrics reflect live canon status counts

- [x] 3. Tauri commands
  - [x] 3.1 `list_canon_entries`, `get_canon_entry`, `create_canon_entry`,
        `update_canon_entry`, `delete_canon_entry`, `list_revisions_for_entity`

- [x] 4. Frontend data layer
  - [x] 4.1 `lib/types.ts`: CanonEntry/NewCanonEntry/CanonEntryPatch/CanonFilter/
        CanonStatus/RevisionEntry types, extend DashboardMetrics
  - [x] 4.2 `lib/tauri.ts`: `api.canon.*`, `api.revisions.listForEntity`
  - [x] 4.3 `lib/mockBackend.ts`: mock canon CRUD + version increment + a shared
        in-memory revisions log appended to by ALL entity types (characters, events,
        canon), so history queries work identically to the real backend
  - [x] 4.4 `hooks/useCanon.ts`, `hooks/useRevisions.ts`

- [x] 5. Canon module
  - [x] 5.1 `CanonList.tsx`: list + status filter (reuse CharacterList patterns)
  - [x] 5.2 `CanonDetail.tsx`: autosave fields (description, category, notes), status
        <Select>, version display (read-only)
  - [x] 5.3 `CanonDependencies.tsx`: depends_on picker + relates_to picker

- [x] 6. Revision History panel
  - [x] 6.1 `RevisionHistoryPanel.tsx`: reusable, takes `entityId`, chronological list,
        human-readable shallow diff summary per entry (`diffSummary.ts`, 8 unit tests)
  - [x] 6.2 Wire into `CanonDetail.tsx` (via `RevisionHistoryButton` + modal)
  - [x] 6.3 Wire into `CharacterDetail.tsx` (proves genuine reusability per FR5)
  - [x] 6.4 Wire into `EventDetailPanel.tsx` (inline, since it's already in a modal)

- [x] 7. Dashboard & navigation
  - [x] 7.1 Move "Canon" from COMING_SOON_CARDS to a live MetricCard
  - [x] 7.2 Sidebar: add "Canon" nav entry + route
  - [x] 7.3 `App.tsx`: register `/canon` route

- [x] 8. Frontend behavioral tests (Vitest) -- `Canon.behavior.test.tsx`, 7/7 passing
  - [x] 8.1 Create canon entry, defaults to Draft, persists with zero save action (AC1)
  - [x] 8.2 Status transitions reflected in Dashboard Canon card (AC2)
  - [x] 8.3 depends_on + relates_to links created and cleanly removed on delete (AC3)
  - [x] 8.4 Canon entry History panel shows create + status-change + update actions (AC4)
  - [x] 8.5 Character History panel shows its own history (AC5, proves genuine reuse)
  - [x] 8.6 Dashboard Canon card live counts (AC6)
  - [x] 8.7 Sidebar navigation to Canon

- [x] 9. Verification
  - [x] 9.1 `cargo test -p loreforge-core` — 37/37 pass (22 prior + 15 new)
  - [x] 9.2 `tsc -b` and `vite build` — clean
  - [x] 9.3 `vitest --run` — 51/51 pass (44 prior + 7 new behavioral tests)
  - [x] 9.4 Manual walkthrough against requirements-phase-3-canon.md Acceptance
        Criteria 1-6 -- confirmed via the automated behavioral test suite above
  - [ ] 9.5 `cargo check` for `src-tauri`: **blocked in this sandbox**, same root cause
        as Phase 1/2 (no `webkit2gtk`/`libsoup-3.0` system packages on Amazon Linux
        2023). The new canon + revision Tauri commands are thin, mechanical wrappers
        over the fully-tested `loreforge-core::canon`/`revisions` modules; verify with
        `cargo tauri dev` on a real machine or in CI.

## Bugs found and fixed while implementing this phase

- `revisions::list_for_record` initially ordered by `changed_at DESC, id DESC`. Since
  `changed_at` comes from SQLite's `datetime('now')` (second precision) and `id` is a
  random UUID, multiple revisions recorded within the same second (routine in bursts of
  edits, and in tests) would tie and could sort in the wrong order. Fixed by ordering on
  SQLite's implicit `rowid` (true insertion order) as the tiebreaker instead. The mock
  backend's `recordRevision` helper documents the same class of bug for anyone porting
  this logic elsewhere.
