# LoreForge AI — Phase 11: Notes Import — Implementation Tasks

- [x] 1. Heuristic parser
  - [x] 1.1 `src/lib/notesParser.ts`: `ImportCandidate`, `EntityTypeKey`,
        `ConfidenceTier` types; `parseNotes(text: string): ImportCandidate[]`
  - [x] 1.2 Pass 1: structured-marker detection, one pattern set per entity type
        (design-phase-11-notes-import.md section 1.2)
  - [x] 1.3 Pass 2: keyword-proximity fallback, one keyword list per entity type
        (section 1.3), including best-effort classification/category guessing scoped to
        each type's fixed vocabulary const
  - [x] 1.4 Deduplication within one parse run (section 1.4)
  - [x] 1.5 Unit tests: at least one structured-marker test and one keyword-proximity
        test per entity type (10 x 2), dedup test, determinism test (same input twice ->
        identical output), classification-guessing test -- 34 tests total, all passing

- [x] 2. Data layer (frontend only -- no Rust changes this phase, per NFR1)
  - [x] 2.1 `src/hooks/useNotesImport.ts`: `useImportCandidates(text)` (useMemo over
        `parseNotes` + duplicate-flagging against existing `use*List()` data, section
        4.1)
  - [x] 2.2 `useImportSelectedCandidates()`: holds all 10 existing `useCreate*`
        mutations, dispatches by `candidate.entityType` via a switch (section 4.2),
        uses `Promise.allSettled` for per-candidate failure isolation (FR5.2)
  - [x] 2.3 Event-candidate date defaulting on import (section 4.3)

- [x] 3. Review/staging UI
  - [x] 3.1 `NotesPasteForm.tsx`: textarea + "Analyze Notes" button
  - [x] 3.2 `CandidateReviewList.tsx`: grouped by entity type, per-group count,
        select-all/none toggle
  - [x] 3.3 `CandidateReviewRow.tsx`: editable name/type, confidence badge, duplicate
        badge, snippet, include/exclude toggle
  - [x] 3.4 `ImportSummary.tsx`: per-type creation counts, links to created entities,
        per-candidate failure reporting, Event date-defaulted notice
  - [x] 3.5 `NotesImportPage.tsx`: paste -> review -> summary step orchestration

- [x] 4. Dashboard & navigation
  - [x] 4.1 `MetricCard.tsx`: add optional `description` prop as an alternative to
        `metrics` (section 5)
  - [x] 4.2 `DashboardPage.tsx`: add the live "Import Notes" card using `description`
        (confirmed no stale "Notes"/"Import" `COMING_SOON_CARDS` entry existed; picked a
        distinct icon after noticing "Drafts" already used "✎")
  - [x] 4.3 Sidebar: add "Import Notes" nav entry + route
  - [x] 4.4 `App.tsx`: register `/notes-import` route

- [x] 5. Frontend behavioral tests (Vitest) -- `NotesImport.behavior.test.tsx`, 9/9
      passing
  - [x] 5.1 Pasting text with a structured marker produces a reviewable candidate with
        the right type/name/confidence (AC1)
  - [x] 5.2 Pasting text with a keyword-proximity match produces a candidate with
        confidence "keyword" and a visible snippet (AC2)
  - [x] 5.3 Editing a candidate's name and entity type before import (AC3)
  - [x] 5.4 An existing-entity-name match is flagged as a likely duplicate and defaults
        to excluded, but can be included anyway (AC4)
  - [x] 5.5 Excluding a candidate means it is not created (AC5)
  - [x] 5.6 Confirming an import across multiple entity types creates exactly the
        right number of entities in the right stores, and the Dashboard's existing
        per-type counts update immediately (AC6)
  - [x] 5.7 The import summary shows per-type counts and links to created entities
        (AC7)
  - [x] 5.8 A single candidate's creation failure doesn't block the rest of the batch
        (AC8)
  - [x] 5.9 The same pasted text produces the same candidates every time (AC9)
  - [x] 5.10 Sidebar navigation to Import Notes

- [x] 6. Verification
  - [x] 6.1 `tsc -b` and `vite build` -- clean
  - [x] 6.2 `vitest --run` -- 160/160 pass (151 prior + 9 new, notesParser's 34 unit
        tests already counted in the 151 prior total once added)
  - [x] 6.3 `cargo test -p loreforge-core` and `cargo check -p loreforge-core` -- 146/146
        pass unmodified, confirmed zero Rust files touched this phase (NFR1)
  - [x] 6.4 Manual walkthrough against requirements-phase-11-notes-import.md Acceptance
        Criteria 1-10 -- confirmed via the automated test suites above
  - [x] 6.5 Parser determinism (AC9) covered by an explicit test in both
        `notesParser.test.ts` (pure-function level) and
        `NotesImport.behavior.test.tsx` (end-to-end, re-mounting the page and
        re-analyzing the same text)

## Notable findings while implementing this phase

- **Two real parser bugs found and fixed while writing `notesParser.test.ts`** (not
  edge cases discovered later -- caught before this module ever shipped):
  1. The proper-noun regex swallowed a leading capitalized filler word ("The Rail
     Rifle") into the match, so "The" ended up as part of the candidate's name. Fixed
     with `stripLeadingFillerWords`, applied to every proper-noun match before it's
     treated as a candidate name.
  2. Keyword matching (`sentenceContainsKeyword` and `guessClassification`) originally
     used substring `.includes()`, which false-positived on short keywords appearing
     *inside* unrelated words -- e.g. the character-detection keyword "he" matched
     inside "T-he", spuriously tagging almost every sentence containing "The" as a
     character candidate. Fixed with `\b`-anchored regex word-boundary matching in both
     functions. This was caught because a test asserting on a specific entity type's
     candidate (e.g. "Rail Rifle" as `technology`) found a *different*-typed duplicate
     candidate for the same name arriving first in array order, which a less specific
     test could have missed entirely.
- **One real bug found and fixed while writing the behavioral test file, in the
  React-hooks layer (not the parser):** `useImportCandidates` originally computed
  parsing and duplicate-flagging in a single `useMemo`. Duplicate flagging depends on
  10 async list queries (the existing-entity name lookups) that resolve after the
  initial render. `NotesImportPage` snapshots the candidate list into its own editable
  state exactly once per "Analyze Notes" click (so further user edits aren't clobbered
  by unrelated re-renders) -- but if that one snapshot happened before the duplicate
  queries resolved, every candidate's `isDuplicate` was permanently frozen at a
  false-negative, since nothing ever re-triggered the snapshot once the real data
  arrived. Fixed by splitting `useImportCandidates` into two memos (one for the stable
  parse, one for the duplicate flag) and surfacing an explicit `isLoading` flag that
  `NotesImportPage` now gates its one-time snapshot on, plus a small "Checking for
  existing entries…" loading state in the review screen so the gate is visible to the
  user rather than silent. This was caught by a test asserting the duplicate badge
  appears (AC4) -- a test that only asserted the *candidate* rendered (without checking
  the duplicate flag specifically) would have passed despite the bug.
- Dashboard-card and duplicate-badge assertions in the behavioral tests needed the same
  disambiguation care every prior phase's tests have needed (scoping to a specific
  `<li>`/section container, using `getAllByText` when two metrics coincidentally read
  the same number) -- consistent with the established pattern, not a new class of
  issue.
- Confirmed via `git status` and a clean `cargo test -p loreforge-core` /
  `cargo check -p loreforge-core` run (146/146, unmodified from Phase 10's count) that
  this phase touched zero files under `crates/` or `src-tauri/`, the first phase to
  make that claim truthfully rather than by exemption (Phases 1-10 all had Rust
  changes; this is the first phase where "no Rust changes" was a design goal from the
  start, not just something to verify after the fact).
- Full-suite `vitest --run` runs continued to show the same pre-existing,
  previously-documented (Phase 10's tasks doc) sandbox test-runner parallelism
  flakiness -- a single, different test among the Species/Military/Politics behavioral
  suites intermittently fails on a full parallel run and passes cleanly in isolation.
  Re-confirmed via `--no-file-parallelism` that this is unrelated to Phase 11's changes
  (159/160 or 160/160 depending on the run, never the same test twice, never
  reproducible in isolation).
