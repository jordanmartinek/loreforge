# LoreForge AI — Phase 3: Canon Management — Design

## 1. Data Model

```sql
-- New in Phase 3 --------------------------------------------------

CREATE TABLE canon_details (
  entity_id    TEXT PRIMARY KEY REFERENCES entities(id),
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft', -- 'draft'|'under_review'|'approved'|'deprecated'
  version      INTEGER NOT NULL DEFAULT 1,
  notes        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_canon_details_status ON canon_details(status);
```

Title lives on `entities.name`, `entity_type = 'canon'` — identical pattern to Character
and Event. Two new `relationships.relationship_type` values, no schema change:

```
'depends_on'  : canon entry -> canon entry (source depends on target)
'relates_to'  : canon entry <-> character | event (either direction)
```

**Version vs. revision history**: `canon_details.version` is a small integer surfaced to
the user ("Version 4"). `revisions` is the underlying append-only technical log (one row
per mutation, with before/after JSON snapshots) that already exists from Phase 1 and has
been populated by every character/event mutation without any UI ever reading it. Phase 3
introduces the first reader.

## 2. Backend (Rust) Structure

```
crates/loreforge-core/src/
  canon.rs        - create/get/list/update/delete for canon entries (mirrors events.rs);
                    update() increments `version` in the same transaction as the content
                    change and the revisions::record() call (NFR2)
  revisions.rs      - + list_for_record(conn, entity_id) -> Vec<RevisionEntry>, a new
                        *read* function (revisions.rs previously only had record(), the
                        write side)
  models.rs          - + CanonEntry, NewCanonEntry, CanonEntryPatch, CanonFilter,
                        RevisionEntry DTOs; extend DashboardMetrics with canon fields
```

`canon.rs::update` differs from `characters::update`/`events::update` in exactly one way:
after applying the patch, it also does
`UPDATE canon_details SET version = version + 1 WHERE entity_id = ?` in the same
transaction, before the `revisions::record` call captures the "after" snapshot (so the
recorded snapshot includes the bumped version).

`revisions::list_for_record` is a straightforward `SELECT ... WHERE entity_id = ? ORDER BY
changed_at DESC LIMIT ?` — the `entity_id` column was always meant to be polymorphic
(entity or relationship id, per Phase 1's `RecordType`), so no schema work is needed, only
a query. A `limit` parameter (default 50) exists to satisfy NFR3 up front rather than
retrofitting pagination later.

`src-tauri/src/commands.rs` gains: `list_canon_entries`, `get_canon_entry`,
`create_canon_entry`, `update_canon_entry`, `delete_canon_entry`,
`list_revisions_for_entity`.

## 3. Frontend Structure

```
src/
  lib/
    types.ts          - + CanonEntry, NewCanonEntry, CanonEntryPatch, CanonFilter,
                         CanonStatus, RevisionEntry, extend DashboardMetrics
    tauri.ts / api.ts   - + api.canon.*, api.revisions.listForEntity
    mockBackend.ts      - + mock canon CRUD, version increment on update, and a
                          parallel in-memory `revisions` log so the mock backend can
                          answer history queries with the same shape as the real one
  hooks/
    useCanon.ts          - useCanonEntries/useCanonEntry + create/update/delete
                           mutations (mirrors useEvents.ts)
    useRevisions.ts       - useRevisionsForEntity(entityId)
  components/
    canon/
      CanonList.tsx        - virtualized list (reuse CharacterList's pattern), filter by
                            status
      CanonDetail.tsx       - AutosaveField-based editor, status <Select>, category field
      CanonDependencies.tsx  - depends_on picker (canon-to-canon) + relates_to picker
                              (canon-to-character/event), both built on the same
                              RelationshipEditor primitives Phase 1/2 already established
    history/
      RevisionHistoryPanel.tsx - the reusable component from FR4.4: takes an `entityId`
                                prop, fetches via useRevisionsForEntity, renders a
                                chronological list with a human-readable field-diff
                                summary per entry
  pages/
    CanonPage.tsx
```

### 3.1 Why the mock backend needs its own revision log

Every prior phase's mock backend (`mockBackend.ts`) stored *current* state only —
characters, relationships, events — because nothing before Phase 3 ever needed history.
`RevisionHistoryPanel` needs something to query in the browser-dev/test environment, so
`mockBackend.ts` gains an in-memory `revisions: RevisionEntry[]` array that every
create/update/delete across *all* mock entity types appends to, mirroring exactly what the
real Rust `revisions::record` calls do. This keeps the mock backend's contract identical to
the real backend's (per the Phase 1 design principle established in `lib/api.ts`), so the
same behavioral tests exercise both.

### 3.2 Human-readable diff summaries (FR4.2)

Rather than a full JSON diff viewer, `RevisionHistoryPanel` computes a shallow diff between
`before_json` and `after_json` (both already stored as full snapshots) and renders
`"name: 'Old' → 'New'"`-style lines for every top-level field that changed. This is
sufficient for "what changed" at a glance without building a generic tree-diff UI, which is
explicitly deferred (FR4.2 scope note).

### 3.3 Status workflow UI

`CanonDetail.tsx` renders status as a `<Select>` with all four values always enabreled
(FR2.2 — no enforced linear transitions), consistent with how Character `role`/`status`
and Event `significance` are already edited elsewhere in the app. No new state-machine
abstraction needed.

## 4. Dashboard Integration

Same pattern as Phase 2's Timeline card: `DashboardPage.tsx`'s "Canon" entry moves from
`COMING_SOON_CARDS` to a live `MetricCard` fed by extended `DashboardMetrics` fields
(`canon_approved`, `canon_draft`, `canon_under_review`, `canon_deprecated`).

## 5. Extensibility Notes for Future Phases

- `RevisionHistoryPanel` takes only an `entityId`; when Phase 4+ adds Locations,
  Technology, etc., they get history browsing with zero new component work.
- Project Snapshots (hourly/daily/before-bulk-import) are a coarser, separate mechanism
  (whole-database checkpoints) layered on top of this same `revisions` table later; this
  phase doesn't need to anticipate their exact shape beyond not breaking the append-only
  nature of `revisions`.
- "Restore this version" (deferred per FR4.3) will, when built, read the same
  `before_json`/`after_json` snapshots this phase's panel already renders — no new storage
  needed, only a write path that re-applies an old snapshot as a new revision.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no restore-from-history action, no canon conflict
detection, no AI suggestions, no Project Snapshots, no full diff viewer. The data model
(`canon_details` + `depends_on`/`relates_to` relationships + `revisions::list_for_record`)
is shaped so none of these require a schema migration when they arrive.
