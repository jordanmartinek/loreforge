# LoreForge AI — Phase 12: Universe Graph Expansion — Tasks

- [x] 1. Shared entity-type registry
  - [x] 1.1 New `src/lib/entityTypes.ts`: hoist `EntityTypeKey`, `ENTITY_TYPE_KEYS`,
        `ENTITY_TYPE_LABELS` out of `notesParser.ts` (Phase 11); add
        `ENTITY_TYPE_COLORS` (one fixed hex color per type)
  - [x] 1.2 `notesParser.ts` re-exports the three original names unchanged from the new
        module, so every existing notes-import import site needs no change

- [x] 2. `useGraphData.ts`: multi-type node/link selector
  - [x] 2.1 Source nodes from all 10 entity types' own `use*` list-query hooks
        (Characters, Locations, Technologies, Species, MilitaryUnits,
        PoliticalEntities, Religions, Organizations, CanonEntries, Events)
  - [x] 2.2 Map each type's own "kind" field (role/location_type/category/
        classification/branch/status/significance) into a common `GraphNode.subtitle`
  - [x] 2.3 Compute degree across the merged node set (post-merge, not per-type), so
        cross-type relationships (e.g. Politics' `controls`) contribute correctly
  - [x] 2.4 Apply `entityTypeFilter: Set<EntityTypeKey>` client-side over
        already-loaded data (no new queries triggered by toggling a filter)
  - [x] 2.5 Add `hasAnyEntities` (independent of the active filter) to distinguish
        "genuinely empty universe" from "filtered down to nothing" -- found and fixed
        as a real bug during test-writing (see Notable Findings)

- [x] 3. `UniverseGraph.tsx`: persistent labels + multi-type rendering
  - [x] 3.1 Default `activeTypes` to all 10 types (not just Character)
  - [x] 3.2 `nodeCanvasObject` + `nodeCanvasObjectMode: "after"` to draw each node's
        name as a persistent label beneath its circle, with a background rectangle for
        legibility over busy backdrops
  - [x] 3.3 Label font size scales inversely with `globalScale` (zoom-independent
        screen size); dimmed label color when a node is outside the current
        click-to-highlight neighborhood
  - [x] 3.4 Node color driven by `ENTITY_TYPE_COLORS[node.entityType]` instead of
        Phase 1's role-based palette
  - [x] 3.5 Branch the empty-state render on `hasAnyEntities`, not `nodes.length`; add
        an in-filter-bar "No entities match the active filters" message for the
        filtered-to-nothing case

- [x] 4. `GraphFilters.tsx`: 10-entry filter bar / legend
  - [x] 4.1 Iterate `ENTITY_TYPE_KEYS` instead of a single hardcoded Character entry
  - [x] 4.2 Render each entity type's `ENTITY_TYPE_COLORS` swatch next to its toggle
        (dimmed via opacity when inactive), doubling as the graph's color legend

- [x] 5. Tests
  - [x] 5.1 `useGraphData.test.tsx` (new): node-per-type coverage across all 10 types,
        filter exclusion, cross-type degree computation, cross-type link inclusion/
        exclusion under filtering
  - [x] 5.2 `UniverseGraph.test.tsx` (extended): all-10-types-active-by-default filter
        bar, multi-type plotting, toggle behavior, and the `hasAnyEntities` regression
        guard (filter bar stays visible/interactive when filtered to nothing)

- [x] 6. Verify: `tsc -b`, `vite build`, full `vitest` suite pass (no Rust/backend
      changes this phase -- confirmed zero diff under `crates/`/`src-tauri/`)

- [x] 7. Commit, push branch, create PR, summarize to user

## Notable Findings

1. **Real bug, found via test-writing, not via manual QA**: the initial plan reused
   Phase 1's `nodes.length === 0` check as the sole condition for the graph's
   full-empty-state render. Writing a test for "toggle off the only type with data"
   immediately exposed that this makes the *filter bar itself* disappear along with the
   nodes -- Phase 1's empty state renders no filter bar at all, on the reasoning that
   there's nothing to filter when the universe is genuinely empty. But "filtered to
   zero" and "genuinely empty" are different states once there are 10 independently
   toggleable types instead of 1, and conflating them stranded the user with no way to
   turn the type back on. Fixed by adding `hasAnyEntities` to `useGraphData`'s return
   value, computed independently of the active filter, and branching the two empty
   states on different conditions (`!hasAnyEntities` for the full empty state,
   `nodes.length === 0` for the lighter in-context message). Covered directly by a
   regression test in `UniverseGraph.test.tsx`.
2. **Pre-existing test-runner flake, unrelated to this phase**: the full `vitest --run`
   suite shows exactly one failing test, in a *different* behavioral suite each run
   (Politics, then Religions, on two separate full-suite runs) -- consistent with the
   flake documented in Phase 10/11's notes (a single test among the Species/Military/
   Politics/Religions behavioral suites intermittently fails only under parallel
   execution). Confirmed unrelated to this phase's changes by stashing all Phase 12
   changes and re-running the same Politics test file in isolation with
   `--no-file-parallelism`: it still failed intermittently (2 of 3 runs) against the
   unmodified Phase-11 codebase.
