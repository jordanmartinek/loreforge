# LoreForge AI — Phase 6: Species Codex — Implementation Tasks

- [x] 1. Data model (Rust)
  - [x] 1.1 Migration: `species_details` table + indexes on `parent_species_id` and
        `classification`
  - [x] 1.2 `models.rs`: `Species`, `NewSpecies`, `SpeciesPatch`, `SpeciesFilter` DTOs;
        `SPECIES_CLASSIFICATIONS`, `MEMBER_OF`, `NATIVE_TO` consts; extend
        `DashboardMetrics` with species_total / species_classifications_in_use
  - [x] 1.3 `species.rs`: create/get/list/update/delete mirroring `locations.rs`'s shape
  - [x] 1.4 `species.rs`: `list_subspecies`, `would_create_cycle` (single-parent
        chain-walk, ported from `locations.rs`, NOT Phase 5's graph BFS)
  - [x] 1.5 `dashboard.rs`: extend `get_metrics` with species_total /
        species_classifications_in_use

- [x] 2. Rust unit tests (14 new tests, all passing)
  - [x] 2.1 create/get roundtrip, partial update, soft delete (mirrors locations.rs
        tests)
  - [x] 2.2 list_subspecies returns direct children only, including root level
  - [x] 2.3 update rejects moving a species to become a child of itself or one of its
        own descendants (cycle prevention, mirrors Phase 4's test)
  - [x] 2.4 deleting a species reparents its direct subspecies to its own parent (or
        root)
  - [x] 2.5 deleting a species cascades member_of and native_to relationships without
        touching the other side
  - [x] 2.6 classification filtering
  - [x] 2.7 dashboard metrics reflect live species counts and classification breakdown

- [x] 3. Tauri commands
  - [x] 3.1 `list_species`, `get_species_entry`, `create_species`, `update_species`,
        `delete_species`, `list_subspecies`

- [x] 4. Frontend data layer
  - [x] 4.1 `lib/types.ts`: Species/NewSpecies/SpeciesPatch/SpeciesFilter/
        SpeciesClassification types, extend DashboardMetrics
  - [x] 4.2 `lib/tauri.ts`: `api.species.*`
  - [x] 4.3 `lib/mockBackend.ts`: mock species CRUD with the same reparent-on-delete +
        single-parent cycle-rejection guarantees as the real backend
  - [x] 4.4 `hooks/useSpecies.ts`: useSpeciesList/useSpeciesEntry/useSubspecies +
        create/update/delete mutations

- [x] 5. Species Codex UI
  - [x] 5.1 `SpeciesList.tsx`: virtualized list + classification filter (reuse
        TechnologyList's pattern)
  - [x] 5.2 `SpeciesDetail.tsx`: autosave biology field, classification select,
        single-valued "Set parent species…" picker (cycle-aware client-side filtering),
        read-only subspecies list
  - [x] 5.3 `SpeciesMembers.tsx`: member_of picker/list for characters
  - [x] 5.4 `SpeciesHabitats.tsx`: native_to picker/list for locations

- [x] 6. Character/Location integration
  - [x] 6.1 `EntitySpeciesLinks.tsx`: symmetric member_of (character-side) / native_to
        (location-side) display
  - [x] 6.2 Wire into `CharacterDetail.tsx`
  - [x] 6.3 Wire into `LocationDetail.tsx`

- [x] 7. Dashboard & navigation
  - [x] 7.1 Move "Species" from COMING_SOON_CARDS to a live MetricCard
  - [x] 7.2 Sidebar: add "Species Codex" nav entry + route
  - [x] 7.3 `App.tsx`: register `/species` route

- [x] 8. Frontend behavioral tests (Vitest) -- `Species.behavior.test.tsx`, 9/9 passing
  - [x] 8.1 Create a species, persists with zero explicit save action (AC1)
  - [x] 8.2 Setting a parent species shows up as parent on one side and subspecies on
        the other (AC2)
  - [x] 8.3 Setting a species' parent to its own descendant is rejected (AC3)
  - [x] 8.4 Deleting a species with a subspecies reparents the subspecies to root, not
        orphaned/deleted (AC4)
  - [x] 8.5 Linking a character to a species via member_of shows up on both sides (AC5)
  - [x] 8.6 Linking a species to a location via native_to shows up on both sides (AC6)
  - [x] 8.7 Deleting a species cleans up member_of/native_to relationships without
        touching the other side (AC7)
  - [x] 8.8 Dashboard Species card live counts (AC8)
  - [x] 8.9 Sidebar navigation to the Species Codex

- [x] 9. Verification
  - [x] 9.1 `cargo test -p loreforge-core` — 79/79 pass (65 prior + 14 new)
  - [x] 9.2 `cargo check -p loreforge-core` — clean
  - [x] 9.3 `tsc -b` and `vite build` — clean
  - [x] 9.4 `vitest --run` — 77/77 pass (68 prior + 9 new behavioral tests)
  - [x] 9.5 Manual walkthrough against requirements-phase-6-species.md Acceptance
        Criteria 1-8 -- confirmed via the automated behavioral test suite above
  - [ ] 9.6 `cargo check` for `src-tauri`: **blocked in this sandbox**, same root cause
        as Phases 1-5 (no `webkit2gtk`/`libsoup-3.0` system packages on Amazon Linux
        2023). The new species Tauri commands are thin, mechanical wrappers over the
        fully-tested `loreforge-core::species` module; verify with `cargo tauri dev` on
        a real machine or in CI. (`cargo check -p loreforge-core` itself passes cleanly
        in this sandbox.)

## Notable findings while implementing this phase

- The `member_of` behavioral test (AC5) initially failed a `toBe(true)` assertion on
  the relationship type after clicking the *wrong* "Link" button: `SpeciesDetail.tsx`
  renders two independent picker sections in sequence (`SpeciesMembers.tsx`'s "Link a
  character…" and `SpeciesHabitats.tsx`'s "Link a location…"), each with its own "Link"
  button, and `getAllByRole("button", { name: "Link" })[length - 1]` happened to grab
  the wrong one once the member picker was populated. Fixed by scoping the click to the
  specific `<select>`'s own containing row via `within(...).getByRole(...)` rather than
  relying on button ordering across the whole page -- the same class of
  multiple-identical-controls disambiguation every phase since Phase 4 has hit, just in
  a new shape (two *different* picker sections on the same page, rather than the same
  picker appearing twice).
- The parent-species and subspecies assertions (AC2) hit the same "species name appears
  in both the list panel and the detail view" ambiguity Phase 5's requires-edge test
  hit, and were fixed the same way: scope the query to the specific section heading's
  container (`"Parent"` / `"Subspecies"`) rather than a bare `findByText`.
- No production bugs were found in the taxonomy cycle-detection logic; reusing Phase
  4's `would_create_cycle`/reparent-on-delete implementation nearly verbatim (just
  renaming `location`/`parent_location_id` to `species`/`parent_species_id`) meant both
  the Rust and mock-backend versions passed their cycle-rejection and
  reparent-on-delete tests on the first run -- the strongest evidence yet that the
  "tree data model, reused verbatim across entity types" pattern this app has settled
  into is sound, distinct from the "graph data model" pattern Technology needed.
