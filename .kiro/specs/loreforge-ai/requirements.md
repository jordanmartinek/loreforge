# LoreForge AI — Requirements

## Product Vision

LoreForge AI is a desktop-native "Creative Operating System" for building and maintaining
large fictional universes. It is **data-based, not document-based**: characters, locations,
technology, scenes, timeline events, canon entries, and mysteries are structured objects
with typed relationships. Documents (chapters, scenes) are views over that underlying graph,
not the source of truth.

This spec covers **Phase 1** of a long-term, modular platform. Later phases (Timeline, Canon,
Mystery Tracker, AI Continuity Checker, Writing Mode, etc.) are listed in "Future Phases"
for context but are explicitly out of scope for this increment.

## Target Platform

- Native desktop application (installable, offline-first), not a hosted web app.
- Single user, single local project database. No auth, no multi-user sync in this phase.
- Dark mode first, keyboard-friendly, desktop information density (inspired by Linear /
  Notion / Obsidian / NASA Mission Control).

## Phase 1 Scope

Phase 1 establishes the foundation everything else depends on:

1. **Core Data Model** — a generic entity + relationship graph stored locally, with
   revision history, that can represent characters today and locations/technology/etc.
   in later phases without schema rewrites.
2. **Universe Dashboard** — landing screen with live metric cards.
3. **Characters Module** — full CRUD, list view, and per-character detail dashboard.
4. **Universe Graph** — interactive visual graph of characters and their relationships.
5. **Autosave & Local-First Persistence** — every edit persists immediately to a local
   SQLite database with a visible save-status indicator. No "Save" button anywhere.

### Explicitly Out of Scope for Phase 1 (Future Phases)

Timeline system, Canon management, World Explorer, Mystery Tracker, Plot Dependency
Engine, Technology Bible, Scene/Chapter builders, Story Analytics, AI Continuity Checker,
AI Lore Assistant, Universe Health Dashboard, AI Refactoring Suggestions, Writing Mode,
Visual Inspiration boards, Franchise Planner, cloud sync/collaboration. These are
acknowledged in the architecture (design.md) so Phase 1's data model doesn't block them,
but no UI/logic for them is built now.

## Functional Requirements

### FR1 — Core Entity & Relationship Model
- FR1.1: The system SHALL store all worldbuilding objects (starting with Character) as
  rows in a generic `entities` table with a `type` discriminator, plus type-specific
  detail tables for structured fields.
- FR1.2: The system SHALL support typed, directional relationships between any two
  entities (`relationships` table: source, target, relationship_type, attributes,
  strength).
- FR1.3: The system SHALL record a revision history entry for every create/update/delete
  of an entity or relationship (who/what changed, timestamp, before/after snapshot).
- FR1.4: Deleting an entity SHALL cascade-clean or flag dependent relationships (no
  orphaned dangling edges that crash the UI).

### FR2 — Autosave / Local-First Persistence
- FR2.1: Every user edit (typing, renaming, creating, deleting, connecting) SHALL be
  written to the local SQLite database without any explicit save action.
- FR2.2: Writes SHALL be debounced/batched where appropriate (e.g., text fields) so
  keystrokes don't cause excessive disk I/O, but SHALL persist within ~500ms of the user
  pausing input.
- FR2.3: The UI SHALL display a persistent, subtle status indicator with three states:
  🟢 All Changes Saved, 🟡 Saving…, 🔴 Offline/Error (queued/retry).
- FR2.4: On app crash or force-quit, no more than the last unsaved debounce window of
  data SHALL be lost.

### FR3 — Universe Dashboard
- FR3.1: On launch, the app SHALL open to a Universe Dashboard, not a file/folder browser.
- FR3.2: The dashboard SHALL show cards for at least: Characters, Universe Graph, Story
  Progress (placeholder metric), and a general "Coming Soon" affordance for modules not
  yet built (Timeline, Canon, Locations, etc.) so the information architecture is visible
  even before those modules exist.
- FR3.3: The Characters card SHALL show live counts: Total, Main, Supporting, Needs
  Development — computed from real data, not hardcoded.
- FR3.4: Dashboard metrics SHALL update reactively when underlying data changes (no
  manual refresh).

### FR4 — Characters Module
- FR4.1: Users SHALL be able to create, rename, edit, and delete characters.
- FR4.2: Each character SHALL support: name, role (Main/Supporting/Minor), status
  (alive/dead/unknown/other), biography, appearance, goals, needs, flaws, secrets,
  psychology notes, dialogue style notes, and an arbitrary tags list.
- FR4.3: Character list view SHALL support search/filter by name, role, and status, and
  SHALL be virtualized so it stays responsive with thousands of characters.
- FR4.4: Character detail view SHALL show a relationships panel listing typed
  relationships to other characters, with the ability to add/edit/remove relationships
  in place (no separate modal-only workflow required, but a modal/inline form is fine).
- FR4.5: All character fields SHALL persist per FR2 (autosave, no save button).

### FR5 — Universe Graph
- FR5.1: The system SHALL render an interactive node-link graph of characters and their
  relationships, initially seeded from Characters module data.
- FR5.2: Hovering a node SHALL show a summary tooltip (name, role, short bio excerpt).
- FR5.3: Clicking a node SHALL highlight its direct relationships and dim unrelated nodes.
- FR5.4: The graph SHALL support filtering by node type (Phase 1: Character only, but the
  filter UI SHALL be structured to add more types later without redesign).
- FR5.5: The graph SHALL update immediately (no manual refresh) when a character or
  relationship is created, edited, or deleted.
- FR5.6: The graph rendering approach SHALL be chosen to scale toward thousands of nodes
  (per long-term scalability goals), even if Phase 1 only exercises it with a small dataset.

### FR6 — App Shell
- FR6.1: The app SHALL provide persistent navigation between Dashboard, Characters, and
  Universe Graph.
- FR6.2: The app SHALL default to dark mode with a light mode toggle.
- FR6.3: The app SHALL support basic keyboard navigation (e.g., a command/quick-open
  affordance is desirable but not mandatory for Phase 1; at minimum, standard focus/tab
  order and Escape-to-close on modals is required).

## Non-Functional Requirements

- NFR1 (Performance): UI interactions (typing, navigating, opening a character) SHALL
  feel instant (<100ms perceived latency) because all reads/writes are local.
- NFR2 (Scalability posture): Data access patterns (paginated/virtualized queries,
  indexed relationship lookups) SHALL be chosen so the design does not need to be
  rewritten to reach the stated long-term scale targets (10k+ characters, 25k+ timeline
  events, etc.), even though Phase 1 won't be tested at that scale.
- NFR3 (Reliability): The local database SHALL use transactions for multi-row writes so
  a crash mid-write cannot corrupt state.
- NFR4 (Portability): The architecture SHALL avoid cloud-only dependencies; the app must
  run fully offline.
- NFR5 (Extensibility): Adding a new entity type (e.g., Location) in a future phase
  SHALL require adding a new detail table + UI module, not restructuring the core
  `entities`/`relationships`/`revisions` tables.

## Acceptance Criteria (Phase 1 "Done")

1. App launches as a native desktop window (via Tauri dev build) directly into the
   Universe Dashboard.
2. User can create a character, fill in its fields, and see them persist across an app
   restart with zero explicit save action.
3. User can create a relationship between two characters and see it reflected in both
   the character detail view and the Universe Graph without refreshing.
4. Deleting a character removes it from list, dashboard counts, and graph, and its
   relationships are cleanly removed (no crashes, no orphan edges rendered).
5. Save-status indicator visibly transitions between Saved/Saving/Offline states during
   real use.
6. Dashboard character counts match actual data at all times.
7. `cargo check` (Rust backend) and `tsc`/`vite build` (frontend) succeed with no errors.
