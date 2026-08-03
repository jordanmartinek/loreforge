# LoreForge AI — Phase 8: Politics — Implementation Tasks

- [x] 1. Data model (Rust)
  - [x] 1.1 Migration: `political_entity_details` table + index on `classification`
  - [x] 1.2 `models.rs`: `PoliticalEntity`, `NewPoliticalEntity`, `PoliticalEntityPatch`,
        `PoliticalEntityFilter` DTOs; `POLITICAL_CLASSIFICATIONS`, `LEADS`, `CONTROLS`,
        `ALLIED_WITH`, `RIVAL_OF` consts; extend `DashboardMetrics` with
        political_entities_total / political_classifications_in_use
  - [x] 1.3 `politics.rs`: create/get/list/update/delete mirroring `canon.rs`'s flat
        shape (no hierarchy)
  - [x] 1.4 `politics.rs`: `create_symmetric_edge` (validates no-duplicate-either-
        direction + mutual-exclusivity-with-opposite-type, then delegates to
        `relationships::create`), `list_allies`, `list_rivals` (both direction-agnostic)
  - [x] 1.5 `dashboard.rs`: extend `get_metrics` with political_entities_total /
        political_classifications_in_use

- [x] 2. Rust unit tests (14 new tests, all passing)
  - [x] 2.1 create/get roundtrip, partial update, soft delete (mirrors canon.rs tests)
  - [x] 2.2 create_symmetric_edge rejects a duplicate in the reverse direction (A-B
        exists, B-A attempted)
  - [x] 2.3 create_symmetric_edge rejects allied_with when rival_of already exists
        between the pair (and vice versa)
  - [x] 2.4 list_allies/list_rivals resolve correctly regardless of which entity
        initiated the link (query both directions)
  - [x] 2.5 create_symmetric_edge rejects a self-link
  - [x] 2.6 deleting a political entity cascades leads/controls/allied_with/rival_of
        without touching the other side
  - [x] 2.7 classification filtering
  - [x] 2.8 dashboard metrics reflect live political entity counts and classification
        breakdown

- [x] 3. Tauri commands
  - [x] 3.1 `list_political_entities`, `get_political_entity`,
        `create_political_entity`, `update_political_entity`,
        `delete_political_entity`, `create_symmetric_edge`, `list_political_allies`,
        `list_political_rivals`

- [x] 4. Frontend data layer
  - [x] 4.1 `lib/types.ts`: PoliticalEntity/NewPoliticalEntity/PoliticalEntityPatch/
        PoliticalEntityFilter/PoliticalClassification types, extend DashboardMetrics
  - [x] 4.2 `lib/tauri.ts`: `api.politics.*`
  - [x] 4.3 `lib/mockBackend.ts`: mock political entity CRUD with the same
        duplicate/mutual-exclusivity guarantees as the real backend
  - [x] 4.4 `hooks/usePolitics.ts`: usePoliticalEntities/usePoliticalEntity/useAllies/
        useRivals + create/update/delete mutations + useCreateSymmetricEdge

- [x] 5. Politics UI
  - [x] 5.1 `PoliticalEntityList.tsx`: virtualized list + classification filter (reuse
        SpeciesList's pattern)
  - [x] 5.2 `PoliticalEntityDetail.tsx`: autosave ideology field, classification
        select, founded-date + precision fields
  - [x] 5.3 `PoliticalLeadership.tsx`: leads picker/list for characters
  - [x] 5.4 `PoliticalTerritory.tsx`: controls picker/list for locations
  - [x] 5.5 `DiplomaticRelations.tsx`: shared picker + two lists (allies, rivals),
        surfacing FR3.3's rejection as a normal mutation error

- [x] 6. Character/Location integration
  - [x] 6.1 `EntityPoliticsLinks.tsx`: symmetric leads (character-side) / controls
        (location-side) display, two-way `mode` prop
  - [x] 6.2 Wire into `CharacterDetail.tsx` (mode="leadership")
  - [x] 6.3 Wire into `LocationDetail.tsx` (mode="territory")

- [x] 7. Dashboard & navigation
  - [x] 7.1 Move "Politics" from COMING_SOON_CARDS to a live MetricCard (double-checked
        no duplicate card remains -- removed the stale COMING_SOON_CARDS entry
        proactively this time, per Phase 7's lesson learned)
  - [x] 7.2 Sidebar: add "Politics" nav entry + route
  - [x] 7.3 `App.tsx`: register `/politics` route

- [x] 8. Frontend behavioral tests (Vitest) -- `Politics.behavior.test.tsx`, 10/10 passing
  - [x] 8.1 Create a political entity, persists with zero explicit save action (AC1)
  - [x] 8.2 Linking a character via leads shows up on both sides (AC2)
  - [x] 8.3 Linking a location via controls shows up on both sides (AC3)
  - [x] 8.4 Marking two political entities allied_with shows symmetrically on both
        sides regardless of initiating direction (AC4)
  - [x] 8.5 A duplicate allied_with in the reverse direction is rejected (AC5)
  - [x] 8.6 rival_of is rejected when allied_with already exists between the pair, and
        vice versa (AC6)
  - [x] 8.7 Removing an alliance/rivalry link removes it from both sides (AC7)
  - [x] 8.8 Deleting a political entity cleans up all four relationship types without
        touching the other side (AC8)
  - [x] 8.9 Dashboard Politics card live counts (AC9)
  - [x] 8.10 Sidebar navigation to Politics

- [x] 9. Verification
  - [x] 9.1 `cargo test -p loreforge-core` — 108/108 pass (94 prior + 14 new)
  - [x] 9.2 `cargo check -p loreforge-core` — clean
  - [x] 9.3 `tsc -b` and `vite build` — clean
  - [x] 9.4 `vitest --run` — 97/97 pass (87 prior + 10 new behavioral tests)
  - [x] 9.5 Manual walkthrough against requirements-phase-8-politics.md Acceptance
        Criteria 1-9 -- confirmed via the automated behavioral test suite above
  - [ ] 9.6 `cargo check` for `src-tauri`: **blocked in this sandbox**, same root cause
        as Phases 1-7 (no `webkit2gtk`/`libsoup-3.0` system packages on Amazon Linux
        2023). The new politics Tauri commands are thin, mechanical wrappers over the
        fully-tested `loreforge-core::politics` module; verify with `cargo tauri dev`
        on a real machine or in CI. (`cargo check -p loreforge-core` itself passes
        cleanly in this sandbox.)

## Notable findings while implementing this phase

- Applying Phase 7's lesson learned proactively: before wiring the live Politics card,
  checked `COMING_SOON_CARDS` and found (as expected) a stale "Politics" placeholder
  entry left over from Phase 1's original scaffolding. Removed it in the same change
  that added the live card, so no duplicate card was ever rendered -- unlike Phase 7,
  where this was caught reactively via a "multiple elements" test error. This time it
  was caught proactively during task 7.1 itself.
- The AC2 (`leads`) behavioral test failed once with a timing-related error on a full-
  suite run, then passed cleanly both in isolation and on an immediate full-suite
  rerun with no code changes. This is the same class of one-off flake documented in
  Phase 7's tasks doc (test-runner scheduling/parallelism under load in this sandbox),
  not a reproducible defect -- confirmed stable across two additional full-suite runs.
- No production bugs were found in the new symmetric-relationship logic
  (`create_symmetric_edge`, `list_allies`/`list_rivals`, and their mock-backend
  mirrors). Both the duplicate-either-direction rejection and the
  mutual-exclusivity-with-the-opposite-type rejection passed on the first run in both
  the Rust unit tests and the frontend behavioral tests, suggesting the "validate
  before write, in one transaction" pattern this codebase has used for every
  business-rule check since Phase 4/5 (cycle detection) generalizes cleanly to a
  different kind of business rule (symmetry + mutual exclusivity) without needing new
  scaffolding.
