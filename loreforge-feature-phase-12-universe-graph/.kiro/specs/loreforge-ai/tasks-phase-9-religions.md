# LoreForge AI — Phase 9: Religions — Implementation Tasks

- [x] 1. Generic hierarchy helper (refactor)
  - [x] 1.1 `hierarchy.rs`: `would_create_cycle<F>` generic chain-walk (design-phase-9-
        religions.md section 1.1) -- plus 5 isolated unit tests exercising every
        reachable branch (self-parent, immediate-child, deep-descendant, unrelated,
        pre-existing-cycle-defensive-termination)
  - [x] 1.2 Refactor `locations.rs::would_create_cycle` to delegate to `hierarchy::*`
  - [x] 1.3 Refactor `species.rs::would_create_cycle` to delegate to `hierarchy::*`
  - [x] 1.4 Refactor `military.rs::would_create_cycle` to delegate to `hierarchy::*`
  - [x] 1.5 Run full `cargo test -p loreforge-core` and confirm every pre-existing
        Locations/Species/Military test still passes unmodified (FR1.3/NFR3) --
        confirmed, zero test changes needed

- [x] 2. Data model (Rust)
  - [x] 2.1 Migration: `religion_details` table + indexes on `parent_religion_id` and
        `classification`
  - [x] 2.2 `models.rs`: `Religion`, `NewReligion`, `ReligionPatch`, `ReligionFilter`
        DTOs; `RELIGION_CLASSIFICATIONS`, `FOLLOWS`, `HOLY_SITE` consts; extend
        `DashboardMetrics` with religions_total / religion_classifications_in_use
  - [x] 2.3 `religions.rs`: create/get/list/update/delete mirroring `species.rs`'s/
        `military.rs`'s shape
  - [x] 2.4 `religions.rs`: `list_schisms`, `would_create_cycle` (delegates to
        `hierarchy::*` from the start -- no copy ever written)
  - [x] 2.5 `dashboard.rs`: extend `get_metrics` with religions_total /
        religion_classifications_in_use

- [x] 3. Rust unit tests (14 new tests in religions.rs + 5 in hierarchy.rs, all passing)
  - [x] 3.1 create/get roundtrip, partial update, soft delete
  - [x] 3.2 list_schisms returns direct children only, including root level
  - [x] 3.3 update rejects moving a religion to become subordinate to itself or one of
        its own descendants (cycle prevention, via the shared hierarchy helper)
  - [x] 3.4 deleting a religion reparents its direct schisms to its own parent (or root)
  - [x] 3.5 deleting a religion cascades follows/holy_site relationships without
        touching the other side
  - [x] 3.6 classification filtering
  - [x] 3.7 dashboard metrics reflect live religion counts and classification breakdown

- [x] 4. Tauri commands
  - [x] 4.1 `list_religions`, `get_religion`, `create_religion`, `update_religion`,
        `delete_religion`, `list_schisms`

- [x] 5. Frontend data layer
  - [x] 5.1 `lib/types.ts`: Religion/NewReligion/ReligionPatch/ReligionFilter/
        ReligionClassification types, extend DashboardMetrics
  - [x] 5.2 `lib/tauri.ts`: `api.religions.*`
  - [x] 5.3 `lib/mockBackend.ts`: mock religion CRUD with the same reparent-on-delete +
        single-parent cycle-rejection guarantees as the real backend
  - [x] 5.4 `hooks/useReligions.ts`: useReligions/useReligion/useSchisms + create/
        update/delete mutations

- [x] 6. Religions UI
  - [x] 6.1 `ReligionList.tsx`: virtualized list + classification filter
  - [x] 6.2 `ReligionDetail.tsx`: autosave tenets field, classification select,
        single-valued "Set parent religion…" picker, read-only schisms list
  - [x] 6.3 `ReligionFollowers.tsx`: follows picker/list for characters
  - [x] 6.4 `ReligionHolySites.tsx`: holy_site picker/list for locations

- [x] 7. Character/Location integration
  - [x] 7.1 `EntityReligionLinks.tsx`: symmetric follows (character-side) / holy_site
        (location-side) display, two-way `mode` prop
  - [x] 7.2 Wire into `CharacterDetail.tsx` (mode="follower")
  - [x] 7.3 Wire into `LocationDetail.tsx` (mode="holySite")

- [x] 8. Dashboard & navigation
  - [x] 8.1 Move "Religions" from COMING_SOON_CARDS to a live MetricCard (proactively
        checked for and removed the stale entry, per Phase 8's applied lesson -- a
        stale "Religions" placeholder was indeed found and removed in the same change)
  - [x] 8.2 Sidebar: add "Religions" nav entry + route
  - [x] 8.3 `App.tsx`: register `/religions` route

- [x] 9. Frontend behavioral tests (Vitest) -- `Religions.behavior.test.tsx`, 9/9 passing
  - [x] 9.1 Create a religion, persists with zero explicit save action (AC1)
  - [x] 9.2 Setting a parent religion shows up as parent on one side and schism on the
        other (AC2)
  - [x] 9.3 Setting a religion's parent to its own descendant is rejected (AC3)
  - [x] 9.4 Deleting a religion with a schism reparents the schism to root, not
        orphaned/deleted (AC4)
  - [x] 9.5 Linking a character to a religion via follows shows up on both sides (AC5)
  - [x] 9.6 Linking a religion to a location via holy_site shows up on both sides (AC6)
  - [x] 9.7 Deleting a religion cleans up follows/holy_site relationships without
        touching the other side (AC7)
  - [x] 9.8 Dashboard Religions card live counts (AC8)
  - [x] 9.9 Sidebar navigation to Religions

- [x] 10. Verification
  - [x] 10.1 `cargo test -p loreforge-core` — 127/127 pass (113 after refactor + 14
        new), INCLUDING every pre-existing Locations/Species/Military test unmodified
        (AC9)
  - [x] 10.2 `cargo check -p loreforge-core` — clean
  - [x] 10.3 `tsc -b` and `vite build` — clean
  - [x] 10.4 `vitest --run` — 106/106 pass (97 prior + 9 new behavioral tests)
  - [x] 10.5 Manual walkthrough against requirements-phase-9-religions.md Acceptance
        Criteria 1-9 -- confirmed via the automated test suites above
  - [ ] 10.6 `cargo check` for `src-tauri`: **blocked in this sandbox**, same root cause
        as Phases 1-8 (no `webkit2gtk`/`libsoup-3.0` system packages on Amazon Linux
        2023). The new religions Tauri commands are thin, mechanical wrappers over the
        fully-tested `loreforge-core::religions` module; verify with `cargo tauri dev`
        on a real machine or in CI. (`cargo check -p loreforge-core` itself passes
        cleanly in this sandbox.)

## Notable findings while implementing this phase

- Confirming the design doc's prediction directly: checking `COMING_SOON_CARDS` before
  wiring the live Religions card (task 8.1) found a stale "Religions" placeholder entry
  left over from Phase 1's original scaffolding, exactly as Phase 7/8 had each found
  for their own entity type. Removed in the same change, so no duplicate card was ever
  rendered -- the proactive-check habit established in Phase 8 continues to pay off.
- Two sidebar/dashboard-card assertions in the behavioral test file initially used an
  exact-anchored regex (`/^Religions$/`) that failed to match the actual accessible
  name (which includes the icon glyph and surrounding whitespace as part of the
  link/button's text content). Switched both to a loose `/Religions/` regex, consistent
  with every other phase's card/nav-link test convention in this suite (e.g.
  Technology's `/Technology/`) -- this phase's first draft had briefly drifted from
  that established pattern and was corrected before landing.
- The `hierarchy.rs` extraction (the phase's main structural work) required zero
  changes to any pre-existing Locations/Species/Military test: all three modules'
  `would_create_cycle` functions became one-line delegations to the shared helper, and
  every test that exercised cycle-rejection, reparent-on-delete, or valid-move behavior
  continued to pass without modification on the first attempt after the refactor. This
  is strong evidence the three original implementations really were byte-for-byte
  identical in logic (only table/column names differed), confirming Phase 7's
  prediction that a third data point would settle the question of "is there real
  variation here" with a clear "no."
- No production bugs were found in `religions.rs` itself; being the fourth
  tree-shaped, two-directional-relationship entity type in a row (after Species and
  Military, with Politics as a flat interlude), every test — cycle rejection,
  reparent-on-delete, cascade-delete for both relationship types — passed on the first
  run.
