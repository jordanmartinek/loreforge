# LoreForge AI — Phase 5: Technology Bible — Design

## 1. Data Model

```sql
-- New in Phase 5 --------------------------------------------------

CREATE TABLE technology_details (
  entity_id        TEXT PRIMARY KEY REFERENCES entities(id),
  category         TEXT NOT NULL DEFAULT 'other',
  description      TEXT NOT NULL DEFAULT '',
  introduced_date  TEXT,                        -- ISO8601 date; nullable (FR1.2)
  date_precision   TEXT NOT NULL DEFAULT 'day'   -- reuses Phase 2's vocabulary
);
CREATE INDEX idx_technology_details_category ON technology_details(category);
```

Name lives on `entities.name`, `entity_type = 'technology'` — identical pattern to every
prior entity type. Two new `relationships.relationship_type` values, no schema change:

```
'requires'         : technology -> technology (source depends on target; DAG edge)
'uses_technology'   : character | event | location -> technology
```

### Why `requires` is a `relationships` row, not a column (contrast with Phase 4)

Phase 4's location hierarchy is a strict *tree*: every location has **at most one**
parent, so a dedicated nullable `parent_location_id` column was the right fit (design-
phase-4-locations.md section 1). A technology's dependency graph is different: a
technology can require *multiple* prerequisites (a weapon needs both a power system and
a targeting AI), and can be required by *multiple* dependents. That's an ordinary N:N
graph, exactly what the `relationships` table already models (same shape as Phase 3's
canon `depends_on`, which is also N:N — a canon entry can depend on several others).
`requires` reuses that pattern directly; no new join table, no new column.

## 2. Backend (Rust) Structure

```
crates/loreforge-core/src/
  technologies.rs   - create/get/list/update/delete, mirroring canon.rs's shape, plus:
                        - list_prerequisites(conn, id) -> Vec<Technology>  (requires edges
                          where this tech is the source)
                        - list_dependents(conn, id) -> Vec<Technology>    (requires edges
                          where this tech is the target)
                        - would_create_cycle(conn, dependent_id, prerequisite_id) -> bool
```

### Generalizing cycle detection from a chain-walk to a graph-walk

Phase 4's `would_create_cycle` walked a single `parent_location_id` chain (each node has
at most one outgoing edge, so "walk up" is unambiguous). A technology can have *multiple*
outgoing `requires` edges, so Phase 5's `would_create_cycle` instead does a bounded
breadth-first traversal: starting from the candidate prerequisite, follow every outgoing
`requires` edge; if the traversal ever reaches `dependent_id`, adding this edge would
close a cycle (FR2.2/FR2.4). A `HashSet` of visited ids bounds the traversal to the number
of technologies that exist, so it terminates even if the existing data somehow already
contains a cycle (defensive, mirrors Phase 4's same defensive posture).

```rust
pub fn would_create_cycle(conn: &Connection, dependent_id: &str, prerequisite_id: &str) -> Result<bool> {
    if dependent_id == prerequisite_id {
        return Ok(true);
    }
    let mut seen = HashSet::new();
    let mut frontier = vec![prerequisite_id.to_string()];
    while let Some(current) = frontier.pop() {
        if current == dependent_id {
            return Ok(true);
        }
        if !seen.insert(current.clone()) {
            continue;
        }
        // Follow this technology's own prerequisites outward.
        for next in list_prerequisite_ids(conn, &current)? {
            frontier.push(next);
        }
    }
    Ok(false)
}
```

This is checked before creating a `requires` relationship — not inside `technologies.rs`
itself, but in the Tauri command / relationship-creation call site that specifically
creates `requires` edges (see section 2.1), since `relationships::create` is generic
across every relationship type in the app and shouldn't need to know about
technology-specific cycle rules.

### 2.1 Where the `requires`-specific cycle check lives

Unlike Phase 4 (where `would_create_cycle` is called from inside `locations::update`,
because reparenting is a location-specific operation), `requires` edges are created
through the generic `relationships::create` function that Phase 1 already built and every
phase since has reused as-is for its own new relationship types (`participates_in`,
`depends_on`, `relates_to`, `located_at`, and now `requires`/`uses_technology`). Rather
than teach the generic `relationships` module about one specific relationship type's
extra validation rule, `technologies.rs` exposes a small wrapper:

```rust
pub fn create_requires_edge(conn: &Connection, dependent_id: &str, prerequisite_id: &str) -> Result<Relationship> {
    if would_create_cycle(conn, dependent_id, prerequisite_id)? {
        return Err(LoreError::InvalidInput(
            "this dependency would create a cycle in the technology tree".into(),
        ));
    }
    relationships::create(conn, NewRelationship {
        source_entity_id: dependent_id.to_string(),
        target_entity_id: prerequisite_id.to_string(),
        relationship_type: REQUIRES.to_string(),
        label: None,
        strength: None,
    })
}
```

The Tauri command for adding a prerequisite calls `technologies::create_requires_edge`,
not `relationships::create` directly — this is the one place the frontend needs to know
"creating this specific kind of edge has extra rules," everywhere else it uses the
generic relationship commands exactly as before.

```
crates/loreforge-core/src/
  models.rs   - + Technology, NewTechnology, TechnologyPatch, TechnologyFilter DTOs;
                TECHNOLOGY_CATEGORIES const; REQUIRES, USES_TECHNOLOGY relationship-type
                consts; extend DashboardMetrics with technologies_total /
                technology_categories_in_use
```

`src-tauri/src/commands.rs` gains: `list_technologies`, `get_technology`,
`create_technology`, `update_technology`, `delete_technology`, `list_prerequisites`,
`list_dependents`, `create_requires_edge`.

## 3. Frontend Structure

```
src/
  lib/
    types.ts           - + Technology, NewTechnology, TechnologyPatch, TechnologyFilter,
                         TechnologyCategory, TECHNOLOGY_CATEGORIES, REQUIRES,
                         USES_TECHNOLOGY; extend DashboardMetrics
    tauri.ts / api.ts    - + api.technologies.{list,get,create,update,delete,
                           listPrerequisites,listDependents,createRequiresEdge}
    mockBackend.ts       - + mock technology CRUD with the same graph-cycle-rejection
                           logic as the real backend
  hooks/
    useTechnologies.ts    - useTechnologies, useTechnology, usePrerequisites,
                           useDependents + create/update/delete mutations +
                           useCreateRequiresEdge
  components/
    technology/
      TechnologyList.tsx     - virtualized list + category filter (reuses CharacterList's
                              pattern directly, since -- unlike Locations -- a flat list
                              is the right primary view; the graph structure lives on the
                              detail view, not the navigation surface)
      TechnologyDetail.tsx     - autosave fields (description), category <Select>,
                                introduced-date + precision fields (reuses the same date
                                input pattern EventDetailPanel.tsx established in Phase 2)
      TechnologyDependencies.tsx - prerequisites picker/list + read-only dependents list
                                  (mirrors CanonDependencies.tsx's depends_on picker
                                  shape, but adds the dependents-in-the-other-direction
                                  display per FR2.3)
      TechnologyUsage.tsx        - uses_technology picker for characters/events/locations
                                  (mirrors LocationRelations.tsx's located_at picker
                                  shape, generalized to three source entity types instead
                                  of two)
  pages/
    TechnologyPage.tsx
```

### 3.1 Why the Technology Bible is a flat list, not a tree (contrast with Phase 4)

Locations needed a tree as the *primary navigation surface* because the hierarchy itself
is how a worldbuilder finds a location ("drill down from Galaxy to the specific room").
A technology's dependency graph isn't navigated that way — a worldbuilder looks up "Void
Drive" by name or browses by category, then inspects its prerequisites/dependents from
its own detail view. So Phase 5 reuses the flat, virtualized, filterable list pattern from
Characters/Events/Canon (`CharacterList.tsx`'s shape) rather than reusing Phase 4's tree
components, even though both phases deal with graph-shaped data underneath.

### 3.2 Client-side cycle filtering in the prerequisite picker

Mirroring Phase 4 section 3.2's approach: `TechnologyDependencies.tsx`'s "Add
prerequisite" picker excludes any technology that already (transitively) depends on the
current technology, computed by walking the same `list_prerequisites`-shaped data forward
on the client. This is a UX nicety only — `technologies::create_requires_edge`'s backend
check (section 2) remains the authoritative guard, consistent with every other validation
in this app being enforced server-side first.

### 3.3 `uses_technology` on Character/Event/Location detail views (FR3.3)

Symmetric to Phase 4's `EntityLocationLinks.tsx` (itself modeled on Phase 2's
`CharacterTimeline.tsx`), a new `EntityTechnologyLinks.tsx` component reads
`uses_technology` relationships where the given entity is the source and resolves the
target technology's name — reusing `useRelationshipsForEntity`, no new data-fetching hook
required. Wired into `CharacterDetail.tsx`, `EventDetailPanel.tsx`, and
`LocationDetail.tsx` (the third integration point Phase 4 anticipated in its own
Extensibility Notes section 5: "Technology... can link to Locations... without any change
to `location_details`").

## 4. Dashboard Integration

Same pattern as every prior phase: `DashboardPage.tsx`'s "Technology" entry moves from
`COMING_SOON_CARDS` to a live `MetricCard` fed by extended `DashboardMetrics` fields
(`technologies_total`, `technology_categories_in_use`).

## 5. Extensibility Notes for Future Phases

- Species, Ships (as distinct entities from the Technology Bible's "ships" category),
  Organizations, Weapons (future phases) can each link to Technology via their own
  `uses_technology`-shaped relationship without any change to `technology_details` or
  the dependency-graph functions.
- The Universe Graph (Phase 1) could be extended to render technology nodes/edges using
  the exact same `requires` relationship data this phase produces — no new backend work,
  only a frontend selector change in `useGraphData.ts`.
- The future AI Continuity Checker's "technology errors" / timeline-contradiction checks
  (from the original brief) read the same `technology_details.introduced_date` +
  `uses_technology` relationships this phase establishes — Phase 5 deliberately keeps
  introduced dates structured (real dates + precision, not free text) so that future
  logic has something concrete to reason over, mirroring Phase 2's same rationale for
  event dates.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no dedicated dependency-graph visual renderer, no
automatic timeline-contradiction detection, no tech tree versioning/branching. The data
model (`technology_details` + `requires`/`uses_technology` relationships) is shaped so
none of these require a schema migration when they arrive.
