# LoreForge AI — Design (Phase 1)

## 1. Platform & Stack

| Layer | Choice | Rationale |
|---|---|---|
| App shell | **Tauri v2** | Native desktop (Win/Mac/Linux), tiny binary vs Electron, Rust backend gives us a real local process for SQLite + future background workers (indexing, AI calls) without a Node runtime tax. |
| Backend logic | **Rust** (Tauri commands) | Owns the SQLite connection, all writes, revision history, and (later) heavy compute like graph layout/indexing/continuity checks. |
| Local DB | **SQLite** via `rusqlite` (bundled) | Zero-config embedded DB, transactional, scales to the stated targets (10k+ rows is trivial for SQLite), file lives in the OS app-data dir. |
| Frontend | **React 18 + TypeScript + Vite** | Fast dev loop, huge ecosystem for the visual-heavy UI (graph, dashboards). |
| Styling | **Tailwind CSS** + small design-token layer | Matches "clean, minimal, dark-mode-first" requirement without hand-rolling a design system from scratch. |
| State/data layer | **TanStack Query** wrapping Tauri `invoke` calls + a thin **Zustand** store for UI-only state (selected node, modal open, theme) | Query gives us caching/refetch-on-mutation for free, which is how the dashboard/graph "update instantly" without manual refresh logic. |
| Graph rendering | **react-force-graph** (canvas-based force-directed graph) | Canvas rendering scales to thousands of nodes far better than SVG/DOM-based graph libs; matches long-term scalability requirement. |
| List virtualization | **@tanstack/react-virtual** | Required for character lists at scale (FR4.3, NFR2). |

No cloud services, no network calls in Phase 1. `network_mode` availability is irrelevant
to Phase 1 runtime; it only matters for `npm install`/`cargo build` during setup.

## 2. Data Model

The core principle (per requirements FR1, NFR5): **one generic entity/relationship/revision
spine**, with type-specific "detail" tables bolted on. This lets Phase 2+ add Location,
Technology, Species, etc. without touching the core tables or the graph/relationship engine.

```sql
-- Core spine -----------------------------------------------------

CREATE TABLE entities (
  id           TEXT PRIMARY KEY,      -- uuid
  entity_type  TEXT NOT NULL,         -- 'character' (future: 'location', 'technology', ...)
  name         TEXT NOT NULL,
  created_at   TEXT NOT NULL,         -- ISO8601
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT                   -- soft delete; NULL = active
);
CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_deleted ON entities(deleted_at);

CREATE TABLE relationships (
  id                TEXT PRIMARY KEY,
  source_entity_id  TEXT NOT NULL REFERENCES entities(id),
  target_entity_id  TEXT NOT NULL REFERENCES entities(id),
  relationship_type TEXT NOT NULL,     -- 'friend' | 'enemy' | 'family' | 'mentor' | ... | custom
  label             TEXT,              -- optional free-text override, e.g. "Estranged brother"
  strength          REAL DEFAULT 0.5,  -- 0..1, changeable over time (Phase 2+: history of strength)
  attributes_json    TEXT,              -- free-form JSON bag for future fields, avoids migrations
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT
);
CREATE INDEX idx_rel_source ON relationships(source_entity_id);
CREATE INDEX idx_rel_target ON relationships(target_entity_id);

CREATE TABLE revisions (
  id            TEXT PRIMARY KEY,
  entity_id     TEXT NOT NULL,         -- entity OR relationship id (polymorphic, see record_type)
  record_type   TEXT NOT NULL,         -- 'entity' | 'relationship'
  action        TEXT NOT NULL,         -- 'create' | 'update' | 'delete'
  before_json   TEXT,                  -- snapshot before change (NULL for create)
  after_json    TEXT,                  -- snapshot after change (NULL for delete)
  changed_at    TEXT NOT NULL,
  note          TEXT                   -- optional user/AI revision note
);
CREATE INDEX idx_revisions_entity ON revisions(entity_id);

-- Type-specific detail tables --------------------------------------

CREATE TABLE character_details (
  entity_id        TEXT PRIMARY KEY REFERENCES entities(id),
  role             TEXT NOT NULL DEFAULT 'supporting', -- 'main' | 'supporting' | 'minor'
  status           TEXT NOT NULL DEFAULT 'alive',      -- 'alive' | 'dead' | 'unknown' | 'other'
  biography        TEXT DEFAULT '',
  appearance       TEXT DEFAULT '',
  goals            TEXT DEFAULT '',
  needs            TEXT DEFAULT '',
  flaws            TEXT DEFAULT '',
  secrets          TEXT DEFAULT '',
  psychology       TEXT DEFAULT '',
  dialogue_style   TEXT DEFAULT '',
  tags_json        TEXT DEFAULT '[]',
  needs_development INTEGER NOT NULL DEFAULT 0 -- boolean flag surfaced on dashboard
);
```

**Why soft delete (`deleted_at`)?** Requirement FR1.4 and the broader "nothing is ever
overwritten" philosophy in the brief means hard deletes are avoided at the DB layer; the
UI treats soft-deleted rows as gone. This also makes "restore" trivial in later phases
without needing the snapshot system yet.

**Why `attributes_json` / `tags_json` bags?** Avoids constant migrations for minor field
additions during early iteration; structured fields that need querying/filtering (role,
status) stay as real columns.

**Revision history**: every Rust command that mutates `entities`, `character_details`, or
`relationships` writes a matching row to `revisions` in the same SQLite transaction. This
satisfies FR1.3 and lays groundwork for the future Version History feature (undo/compare/
restore) without building UI for it yet.

## 3. Backend (Rust / Tauri) Architecture

```
src-tauri/src/
  main.rs              - Tauri builder, registers commands, opens DB on startup
  db/
    mod.rs             - connection pool (single writer conn wrapped in Mutex + r2d2 read pool)
    migrations.rs      - embedded SQL migrations, run on startup (idempotent)
  models/
    entity.rs          - Entity, EntityType enum
    character.rs        - Character (Entity + CharacterDetails combined DTO)
    relationship.rs     - Relationship, RelationshipType
  commands/
    characters.rs       - list_characters, get_character, create_character,
                          update_character, delete_character
    relationships.rs    - list_relationships, create_relationship, update_relationship,
                          delete_relationship
    dashboard.rs         - get_dashboard_metrics
  revisions.rs           - record_revision() helper used by all mutating commands
```

Key backend decisions:
- **Single writer connection** guarded by a `Mutex`, SQLite in WAL mode, so reads aren't
  blocked by writes (supports NFR1 perceived latency + FR2.2 debounced saves).
- Every mutating command runs inside a `BEGIN IMMEDIATE` transaction: update
  `entities.updated_at`, upsert detail row, insert `revisions` row, `COMMIT`. This
  satisfies NFR3 (no partial writes).
- Commands return plain DTOs (serde `Serialize`) so the frontend TypeScript types mirror
  them 1:1 (hand-kept in sync for Phase 1; codegen can come later).
- DB file lives at Tauri's `app_data_dir()/loreforge.db` — no cloud path in Phase 1.

## 4. Frontend Architecture

```
src/
  main.tsx
  App.tsx                     - router + shell (sidebar nav + save-status bar)
  lib/
    tauri.ts                   - typed wrappers around invoke() per command
    types.ts                   - Character, Relationship, DashboardMetrics types
    queryClient.ts
  store/
    uiStore.ts                 - zustand: theme, selected graph node, modal state
    saveStatusStore.ts          - zustand: 'saved' | 'saving' | 'offline', last error
  hooks/
    useCharacters.ts            - TanStack Query hooks (list/get/create/update/delete)
    useRelationships.ts
    useDashboardMetrics.ts
    useAutosaveField.ts         - debounced field -> mutation, drives saveStatusStore
  components/
    shell/  (Sidebar, TopBar, SaveStatusIndicator)
    dashboard/ (DashboardGrid, MetricCard)
    characters/ (CharacterList (virtualized), CharacterDetail, RelationshipEditor)
    graph/ (UniverseGraph, GraphFilters, NodeTooltip)
    ui/ (shared primitives: Button, Input, TextArea, Select, Modal, Badge)
  pages/
    DashboardPage.tsx
    CharactersPage.tsx
    GraphPage.tsx
```

**Autosave mechanism (FR2):**
`useAutosaveField` wraps a field value + a mutation function:
1. Local component state updates immediately (instant perceived typing).
2. A 400–500ms debounce fires the Tauri mutation.
3. On mutation start → `saveStatusStore.set('saving')`.
4. On success → `set('saved')`. On failure → `set('offline')` and the change is kept in an
   in-memory retry queue that re-attempts on interval/reconnect (Phase 1: simulated —real
   "offline" only matters once we add any network dependency, but the state machine and
   indicator exist now so later features slot in).
5. TanStack Query cache is invalidated/updated optimistically so dashboard + graph reflect
   the change without a manual refresh (FR3.4, FR5.5).

**Reactivity for dashboard/graph:** Since everything is local and single-user (no external
writers), optimistic cache updates + query invalidation on every mutation is sufficient —
no need for a push/subscription layer in Phase 1.

## 5. Universe Graph Design

- Data source: `useCharacters()` + `useRelationships()` combined into `{nodes, links}` via
  a memoized selector.
- Rendered with `react-force-graph-2d` (canvas). Node color by `role`, size by number of
  connections (simple degree centrality) — a small, visually meaningful default before any
  "importance" scoring system exists.
- Hover → tooltip (FR5.2). Click → compute 1-hop neighborhood, dim the rest via node/link
  opacity (FR5.3).
- Filter bar is a generic `EntityTypeFilter` component driven by a static list of known
  types (`['character']` today) so adding `'location'`, `'technology'`, etc. later is a
  one-line data change, not a redesign (FR5.4).

## 6. Design System Notes

- Dark background tiers (`#0a0a0f`, `#12121a`, `#1a1a24`) with a single accent color
  (indigo/violet) for interactive elements — deliberately restrained palette per "never
  cluttered" requirement.
- Typography: Inter (or system font stack) with a tight, consistent type scale.
- Cards use subtle borders (not heavy shadows) for the "clean/Apple-like" feel.
- Layout: fixed left icon+label sidebar, main content area uses full viewport height,
  no page-level scroll for the dashboard grid (internal scroll only where needed).

## 7. Extensibility Path (why this won't need a rewrite)

- New entity type → add `<type>_details` table + migration + Rust command module +
  frontend page; `entities`/`relationships`/`revisions` untouched.
- Timeline (Phase 2) → events are just another entity type with a `start_at`/`end_at` on
  its detail table; timeline UI queries entities of type `event` ordered by date.
- Canon, Mysteries, Technology, Locations → same pattern.
- AI Continuity Checker / Lore Assistant (later phase) → reads the same
  entities/relationships tables (plus full-text index added then); no data model change
  needed, only new Rust commands + a pluggable LLM client trait.
- Scaling to 10k+ characters: virtualization (frontend) + indexed SQLite queries
  (backend) already in place; if graph rendering becomes the bottleneck at very large N,
  swap in WebGL renderer (`react-force-graph-3d`/custom) behind the same data interface.

## 8. Out of Scope Confirmation

This design intentionally does not include: timeline engine, canon versioning UI, mystery
tracker, continuity checker, AI lore assistant, scene/chapter builders, analytics,
snapshots/backup scheduler, or multi-user sync. These are acknowledged as future modules
and the data model is shaped to accommodate them, but none are implemented in Phase 1.
