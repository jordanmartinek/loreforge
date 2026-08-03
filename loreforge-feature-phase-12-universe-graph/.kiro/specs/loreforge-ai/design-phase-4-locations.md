# LoreForge AI — Phase 4: World Explorer (Locations) — Design

## 1. Data Model

```sql
-- New in Phase 4 --------------------------------------------------

CREATE TABLE location_details (
  entity_id         TEXT PRIMARY KEY REFERENCES entities(id),
  location_type     TEXT NOT NULL DEFAULT 'other',
  description       TEXT NOT NULL DEFAULT '',
  parent_location_id TEXT REFERENCES entities(id) -- NULL = root level
);
CREATE INDEX idx_location_details_parent ON location_details(parent_location_id);
```

Name lives on `entities.name`, `entity_type = 'location'` — identical pattern to every
prior entity type. `parent_location_id` is the one genuinely new structural idea in this
phase: a self-referential foreign key within a detail table (Phase 1-3 detail tables were
all "flat" — no entity referenced another entity of its own type via a dedicated column).
It's stored in `location_details`, not as a `relationships` row, because parent/child is a
1:1 structural property of a location (a location has *at most one* parent), whereas
`relationships` models arbitrary N:N associations (`participates_in`, `depends_on`,
`relates_to`). Modeling a strict tree edge as a generic relationship would require extra
application-level enforcement ("at most one outgoing `parent_of` edge") that a dedicated
nullable column gets for free from the schema.

`located_at` is a new `relationships.relationship_type` value — ordinary N:N modeling
(a character can be "located at" more than one place over the story, an event has exactly
one location but nothing stops multiple events pointing at the same location), so it
correctly reuses the existing table, unlike parent/child.

## 2. Backend (Rust) Structure

```
crates/loreforge-core/src/
  locations.rs   - create/get/list/update/delete, mirroring canon.rs's shape, plus three
                   hierarchy-specific functions:
                     - list_children(conn, parent_id: Option<&str>) -> Vec<Location>
                     - get_ancestry_chain(conn, id) -> Vec<Location>  (immediate parent
                       first, root last -- caller reverses for breadcrumb display)
                     - would_create_cycle(conn, id, candidate_parent_id) -> bool  (used by
                       both create-with-parent and update-with-new-parent, and by delete's
                       reparenting step, to enforce FR1.3/FR3.3)
```

`locations.rs::update` special-cases `parent_location_id`: before writing a new parent,
it walks the candidate parent's own ancestry chain (via the same logic
`get_ancestry_chain` uses) looking for the location being moved. If found, the move is
rejected as a cycle (FR3.3) before any write happens — validated inside the same
transaction as the update, per NFR3.

`locations.rs::delete` differs from every prior entity type's delete in one structural
way: after soft-deleting the location and cascading its relationships (identical to
Phase 1-3), it also runs
`UPDATE location_details SET parent_location_id = <deleted's old parent> WHERE
parent_location_id = <deleted id>` in the same transaction (FR3.1) — reparenting the
subtree up one level instead of leaving children pointing at a soft-deleted, now-invisible
parent.

```
crates/loreforge-core/src/
  models.rs   - + Location, NewLocation, LocationPatch, LocationFilter DTOs;
                LOCATION_TYPES const; LOCATED_AT relationship-type const; extend
                DashboardMetrics with locations_total / locations_by_type count
```

`src-tauri/src/commands.rs` gains: `list_locations`, `get_location`, `create_location`,
`update_location`, `delete_location`, `list_location_children`,
`get_location_ancestry_chain`.

## 3. Frontend Structure

```
src/
  lib/
    types.ts           - + Location, NewLocation, LocationPatch, LocationFilter,
                         LocationType, LOCATION_TYPES, LOCATED_AT; extend
                         DashboardMetrics
    tauri.ts / api.ts    - + api.locations.{list,get,create,update,delete,listChildren,
                           getAncestryChain}
    mockBackend.ts       - + mock location CRUD with the same reparent-on-delete and
                           cycle-rejection logic as the real backend (so behavioral
                           tests exercise the same tree-integrity guarantees)
  hooks/
    useLocations.ts       - useLocations, useLocation, useLocationChildren,
                           useLocationAncestry + create/update/delete mutations
  components/
    locations/
      WorldExplorerTree.tsx  - recursive expand/collapse tree, rooted at parent=null
                              locations; each node lazily fetches its own children via
                              useLocationChildren rather than the whole tree loading
                              at once (keeps the same "don't render everything at once"
                              posture as the Timeline's windowing, appropriate for a
                              tree that could get deep/wide at scale)
      LocationTreeNode.tsx    - a single expandable row
      LocationBreadcrumb.tsx  - renders the ancestry chain from useLocationAncestry
      LocationDetail.tsx       - autosave fields (description), location_type <Select>,
                                "Move to..." parent picker, located_at linking
      LocationRelations.tsx     - located_at picker for characters/events (mirrors
                                CanonDependencies.tsx's relates_to picker shape)
  pages/
    LocationsPage.tsx
```

### 3.1 Why a lazy per-node tree instead of loading the whole hierarchy at once

Prior list-based modules (Characters, Events, Canon) load their full filtered list and
virtualize the *rendering*. A location hierarchy is different: the interesting scaling
axis is *depth and branching*, not a single long list. `WorldExplorerTree` fetches only
root-level locations up front; each `LocationTreeNode` fetches its own children lazily via
`useLocationChildren(nodeId)`, only when expanded. This means a very large universe (the
long-term target of thousands of locations) never requires loading more than the
currently-expanded path at once, which is the same "don't render/fetch more than what's
visible" principle the Timeline's windowing established in Phase 2, applied to a tree
instead of a horizontal axis.

### 3.2 Cycle prevention on the client

The "Move to…" picker (FR5.4) filters out the location itself and (via
`useLocationAncestry` walked forward, i.e. checking descendants by attempting the same
`would_create_cycle` logic against the candidate) any of its own descendants from the
selectable options, so the common case never reaches the backend's rejection at all. The
backend validation (design.md section 2) remains the authoritative guard regardless, since
the client-side filtering is a UX nicety, not a security/integrity boundary — consistent
with how every other validation in this app (date ranges, non-empty names, status enums)
is enforced authoritatively in `loreforge-core`, not just in the UI.

### 3.3 `located_at` on Character/Event detail views (FR4.4)

Symmetric to Phase 2's `CharacterTimeline.tsx` (which shows a character's participated
events by reading relationships where the character is source), a small addition to
`CharacterDetail.tsx` and `EventDetailPanel.tsx` reads `located_at` relationships where the
character/event is source and resolves the target location's name — reusing
`useRelationshipsForEntity`, no new hook required for this integration point.

## 4. Dashboard Integration

Same pattern as every prior phase: `DashboardPage.tsx`'s "Locations" entry moves from
`COMING_SOON_CARDS` to a live `MetricCard` fed by extended `DashboardMetrics` fields
(`locations_total`, `location_types_in_use`).

## 5. Extensibility Notes for Future Phases

- Technology, Organizations, Species, Ships, etc. (future phases) can each link to
  Locations via their own `located_at`-shaped relationship (e.g. `stationed_at`,
  `headquartered_at`) without any change to `location_details` or the tree-query
  functions — they just become new relationship types pointed at the same location
  entities.
- Map/spatial visualization (deferred): could add optional coordinate fields to
  `location_details` later without breaking the hierarchy, since position and hierarchy
  are orthogonal concerns.
- The lazy per-node tree-fetching pattern (`WorldExplorerTree`) generalizes to any future
  hierarchical entity type (e.g. an Organization org-chart) by the same
  `list_children`/`get_ancestry_chain` shape.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no map/spatial visualization, no linking to
Technology/Scenes/Organizations (don't exist yet), no multi-parent locations. The data
model (`location_details` with a single nullable `parent_location_id`, plus `located_at`
relationships) is shaped so none of these require a schema migration when they arrive.
