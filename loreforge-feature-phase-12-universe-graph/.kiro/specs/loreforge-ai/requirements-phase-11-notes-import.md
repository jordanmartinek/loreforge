# LoreForge AI — Phase 11: Notes Import — Requirements

## Context

Every phase so far (1-10) has added a new *entity type* to the data model, following an
increasingly well-established backend-first pattern: migration, Rust module, Tauri
commands, frontend data layer, UI, dashboard/nav wiring. Phase 11 is different in kind:
it adds no new entity type and no new relationship type. Instead, it adds a new way to
*populate* the ten entity types that already exist, by parsing free-form prose a
worldbuilder pastes in (notes, outlines, a chapter draft, a wiki dump) and surfacing
candidate Characters, Locations, Technology, Species, Military Units, Political
Entities, Religions, Organizations, Canon Entries, and Timeline Events for review before
anything is actually created.

### Why heuristic, not LLM-based

This app has been strictly local-first and offline through every phase so far — no
network dependency has ever been introduced, and the Rust backend only ever talks to a
local SQLite file. Wiring in an LLM-based extractor would be the first time this app
made an external network call, which is a significant architectural change on its own,
separate from the extraction feature itself. Per explicit user direction, Phase 11 uses
a **heuristic, fully local, pattern-based parser** — no network calls, no API keys, works
identically whether the app is running as a packaged Tauri desktop app with no internet
connection or in a browser preview. If LLM-assisted extraction is wanted later, it should
be a deliberate, separately-scoped decision (a new phase), not something this phase backs
into by accident.

### Why this is the first frontend-only phase

Every entity type from Phase 1-10 needed new Rust: a migration, a model, CRUD, Tauri
commands. Notes Import needs none of that. Detected candidates, once confirmed, are
created through the *existing* Tauri commands / mock-backend functions for each entity
type (`api.characters.create`, `api.locations.create`, etc.) — Phase 11 is a new way to
call code that has existed since Phases 1-10, not new backend surface area. This is the
first phase in the project where `crates/loreforge-core` and `src-tauri` have zero
changes, and the sandbox's `webkit2gtk` limitation (which has forced "documented, not
verified" caveats into every prior phase's Rust changes) simply does not apply this
time — there is nothing new on the Rust side to be unable to verify.

## Phase 11 Scope

1. **Paste-in text area** — a dedicated "Import Notes" page where the user pastes
   free-form text directly into a `<textarea>` (per explicit user direction: paste-only
   for this phase, not file upload — file upload can be added later as a strict
   superset, since it would just mean reading a file's contents into the same textarea
   value).
2. **Heuristic parser** — runs entirely client-side (no network call) against the pasted
   text, producing a list of *candidates*, each with: a guessed entity type (one of the
   10), a guessed name, a confidence signal (how the candidate was detected), and the
   source text snippet it came from (so the user can see *why* it was suggested). See
   design-phase-11-notes-import.md section 1 for the detection strategy across all 10
   entity types and section 2 for why confidence is a simple three-tier label, not a
   numeric score.
3. **Review/staging UI** — every candidate is presented for review before creation,
   grouped by detected entity type. For each candidate the user can: edit the guessed
   name and detected entity type (a heuristic guess can be wrong — e.g. a location
   misread as an organization), toggle it included/excluded from the import, and see the
   source snippet. Nothing is created until the user explicitly confirms the import.
4. **Duplicate detection against existing data** — before showing the review list, check
   each candidate's guessed name against every existing entity of the same guessed type
   already in the universe (case-insensitive exact match); flag likely duplicates so the
   user can skip re-creating "Ada Voss" a second time if she's already a Character.
5. **Bulk import** — confirming the review creates one entity per included candidate,
   calling the *existing* per-type creation API (`api.characters.create`,
   `api.locations.create`, etc. — no new backend calls). An import summary shows what
   was created, grouped by type, with a link to each new entity's own page.
6. **Dashboard integration** — a live "Notes Import" card (not a metric card in the
   Phase 1-10 sense, since there's no persistent "notes total" count to show — see
   design doc section 5) linking to the Import Notes page.

### Explicitly Out of Scope for Phase 11

File upload (`.txt`/`.md` import) — paste-only this phase, per explicit user direction;
a natural, additive follow-up but not built now. LLM/AI-assisted extraction — heuristic
only this phase, per explicit user direction; revisit as its own scoped decision if
wanted later (see Context section). Automatic relationship detection (e.g. inferring
that "Ada Voss commands the 3rd Battalion" should create a `serves_in` relationship
between the two) — this phase only detects and creates *entities*, not relationships
between them; relationships between newly-imported entities are left for the user to
add afterward through each entity type's existing detail-view pickers, exactly as if
they'd been created by hand. Editing full entity fields (biography, description,
tenets, etc.) from the review screen — the review screen only lets the user fix the
guessed name and entity type before creation; once created, the new entity is edited
the normal way, on its own detail page, with the full field set and autosave every
other entity type already has. Merging an import candidate into an *existing* entity
(e.g. updating "Ada Voss" 's biography from new notes rather than creating a duplicate)
— duplicate detection only flags and lets the user skip a likely-duplicate candidate;
it does not attempt a merge/update flow, which would need its own design pass.

## Functional Requirements

### FR1 — Paste Input
- FR1.1: The Import Notes page SHALL present a `<textarea>` for pasting free-form text.
- FR1.2: The user SHALL trigger parsing via an explicit "Analyze Notes" action (not
  automatically on every keystroke), so a long paste doesn't cause the parser to run
  repeatedly mid-paste.
- FR1.3: Parsing SHALL run entirely client-side against the current mock-or-Tauri data
  already loaded by the app (for duplicate detection, FR3) — no network call is made at
  any point in this phase.

### FR2 — Heuristic Candidate Detection
- FR2.1: The parser SHALL attempt to detect candidates for all 10 entity types:
  Characters, Locations, Technology, Species, Military Units, Political Entities,
  Religions, Organizations, Canon Entries, and Timeline Events.
- FR2.2: The parser SHALL recognize **structured markers** — a line of the form
  `Label: Name` or a bracketed/heading-style annotation naming the entity type
  explicitly (e.g. "Character: Ada Voss", "Location — New Geneva", "## Technology:
  Rail Rifle") — as a high-confidence signal for both the entity type and the name.
- FR2.3: The parser SHALL recognize **keyword-proximity matches** as a medium-confidence
  fallback: a capitalized proper noun appearing near a type-indicating keyword (e.g.
  "the *Ashenford Trading Guild*" near "guild"/"organization"; "*Solari Faith*" near
  "religion"/"faith"/"worship"; "*3rd Battalion*" near "battalion"/"unit"/"military").
  Each entity type's keyword list is documented in the design doc section 1.3.
  Classification/category guesses (e.g. which of `TECHNOLOGY_CATEGORIES` a detected
  technology belongs to) are attempted via the same keyword-proximity approach but are
  optional — an unmatched classification defaults to that type's existing "other"
  value, identical to what happens if a user creates an entity by hand and leaves the
  classification untouched.
- FR2.4: Every candidate SHALL carry a confidence tier of `structured` or `keyword`
  (FR2.2/FR2.3) and the exact source line/snippet it was extracted from, so a user can
  judge a low-confidence guess against the original text.
- FR2.5: The parser SHALL be deterministic — the same input text SHALL always produce
  the same candidate list, with no randomness and no network dependency (FR1.3).
- FR2.6: Duplicate candidates detected multiple times within the same pasted text
  (e.g. a name mentioned in three different sentences) SHALL be de-duplicated into a
  single candidate before being shown for review, retaining the highest-confidence
  detection's snippet.

### FR3 — Duplicate Detection Against Existing Data
- FR3.1: Before the review screen is shown, each candidate SHALL be checked against all
  existing entities of its guessed type already present in the universe, via a
  case-insensitive exact name match.
- FR3.2: A candidate matching an existing entity's name SHALL be visually flagged as a
  likely duplicate in the review screen (FR4.4) and SHALL default to excluded, so a
  confirmed import does not silently recreate "Ada Voss" as a second, separate
  Character record.
- FR3.3: The user SHALL be able to override FR3.2's default exclusion and include a
  flagged candidate anyway (e.g. because it's intentionally a different entity that
  happens to share a name).

### FR4 — Review/Staging UI
- FR4.1: After parsing, candidates SHALL be presented grouped by detected entity type,
  with a per-type count.
- FR4.2: Each candidate SHALL show: its guessed name (editable), its guessed entity type
  (editable, as a dropdown covering all 10 types), its confidence tier (FR2.4), its
  source snippet, and an include/exclude toggle.
- FR4.3: Candidates SHALL default to included, except duplicates (FR3.2, default
  excluded).
- FR4.4: A duplicate-flagged candidate SHALL be visually distinguished (e.g. a warning
  badge) from a non-duplicate candidate in the review list.
- FR4.5: The user SHALL be able to select/deselect all candidates within a single
  entity-type group in one action, for fast triage of a long list.
- FR4.6: Nothing SHALL be created in the universe until the user explicitly confirms
  the import (a single "Import N Selected" action).

### FR5 — Bulk Creation
- FR5.1: Confirming the import SHALL create one entity per included candidate, via that
  candidate's entity type's existing creation API (no new backend commands are
  introduced by this phase).
- FR5.2: If an individual candidate's creation fails (e.g. a validation error from the
  existing per-type `create` function), the failure SHALL be reported for that specific
  candidate without blocking the rest of the batch from being created.
- FR5.3: After the import completes, a summary SHALL show how many entities were
  created per type, and each created entity SHALL be reachable via a direct link to
  its own type's detail page.
- FR5.4: The Dashboard's existing per-type metrics (Phase 1-10's `characters_total`,
  `locations_total`, etc.) SHALL reflect newly-imported entities immediately, with no
  manual refresh — since imported entities are created via the exact same mutation
  path a manual "+ New" click already uses, this follows automatically from the
  existing query-invalidation behavior and needs no new code to satisfy.

### FR6 — Dashboard & Navigation Integration
- FR6.1: The sidebar SHALL gain an "Import Notes" navigation entry.
- FR6.2: The Dashboard SHALL gain a live "Notes Import" card linking to the Import
  Notes page. Unlike every Phase 1-10 card, this card has no persistent
  count-of-entities-of-this-type metric to show (there is no "Notes" entity type,
  imported text is not stored anywhere) — see design doc section 5 for what the card
  shows instead.

## Non-Functional Requirements

- NFR1 (No backend changes): This phase SHALL NOT modify `crates/loreforge-core` or
  `src-tauri` in any way. All entity creation goes through APIs that already exist as
  of Phase 10.
- NFR2 (No network dependency): The parser SHALL run with zero network requests,
  consistent with every prior phase's offline-first posture (FR1.3, FR2.5).
- NFR3 (Determinism / testability): Given NFR2 and FR2.5, the parser SHALL be pure
  (same input text -> same output candidates every time) so it can be
  unit-tested directly without mocking a network layer or an AI service.
- NFR4 (Consistency with existing UI conventions): The review/staging UI SHALL reuse
  existing UI primitives (`Select`, `Input`, `Button`, `Badge`) and existing per-type
  `useCreateX` mutation hooks rather than introducing a parallel creation path.

## Acceptance Criteria (Phase 11 "Done")

1. Pasting a block of text containing a structured marker line (e.g. "Character: Ada
   Voss") and clicking "Analyze Notes" produces a reviewable candidate with entity type
   "Character", name "Ada Voss", and confidence "structured".
2. Pasting text containing a capitalized proper noun near a type keyword (e.g. "the
   Ashenford Trading Guild, a trading guild based in the city") produces a candidate
   with entity type "Organization" (or another plausible guessed type), confidence
   "keyword", and a visible source snippet.
3. A candidate's guessed name and guessed entity type can both be edited before import.
4. If a candidate's guessed name exactly matches (case-insensitive) an existing entity
   of the same guessed type, it is flagged as a likely duplicate and defaults to
   excluded, but can be included anyway.
5. Excluding a candidate and confirming the import does not create that candidate as an
   entity.
6. Confirming the import with N included candidates across multiple entity types
   creates exactly N new entities, correctly distributed across their respective entity
   type stores (verifiable via each type's own list page and via the Dashboard's
   existing per-type counts updating immediately).
7. An import summary after confirmation shows counts per type and links to each created
   entity.
8. If one candidate's creation fails (e.g. an edited name is blanked out before
   import), the rest of the batch is still created and the specific failure is
   reported.
9. The same pasted text produces the same candidates every time it is analyzed (no
   randomness).
10. `tsc -b`, `vite build`, and the frontend test suite (including new tests for the
    parser and the review/import flow) all pass with no errors. `cargo test` /
    `cargo check` for `loreforge-core` continue to pass unmodified, since this phase
    makes no Rust changes (NFR1).
