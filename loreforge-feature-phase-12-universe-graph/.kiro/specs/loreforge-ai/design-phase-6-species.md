# LoreForge AI — Phase 6: Species Codex — Design

## 1. Data Model

```sql
-- New in Phase 6 --------------------------------------------------

CREATE TABLE species_details (
  entity_id         TEXT PRIMARY KEY REFERENCES entities(id),
  classification    TEXT NOT NULL DEFAULT 'other',
  biology           TEXT NOT NULL DEFAULT '',
  parent_species_id TEXT REFERENCES entities(id) -- NULL = root level
);
CREATE INDEX idx_species_details_parent ON species_details(parent_species_id);
CREATE INDEX idx_species_details_classification ON species_details(classification);
```

Name lives on `entities.name`, `entity_type = 'species'` — identical pattern to every
prior entity type. Two new `relationships.relationship_type` values, no schema change:

```
'member_of'  : character -> species  (source belongs to target)
'native_to'  : species -> location   (source originates from / is found at target)
```

### Why taxonomy is a column (Phase 4's pattern), not a graph (Phase 5's pattern)

This is the one decision this phase actually has to make, since it's the first entity
type to come after both a tree-shaped precedent (Locations) and a graph-shaped precedent
(Technology). Biological taxonomy is genuinely a strict tree: a subspecies has exactly
one parent taxon. It is not possible, in this domain, for "Sub-Saharan Elari" to be a
subspecies of both "Elari" and "Vex-Kin" simultaneously — that would make it a hybrid or
a separate lineage, not a subspecies. That's structurally identical to Phase 4's location
hierarchy (a room has exactly one containing building), and structurally *unlike* Phase
5's technology dependencies (a weapon can depend on both a power system and a targeting
AI). So `species_details.parent_species_id` is a dedicated nullable self-referential
column, and `species.rs` reuses Phase 4's `would_create_cycle` (single-parent chain-walk)
and reparent-on-delete logic near-verbatim, rather than Phase 5's graph-BFS
`would_create_cycle` — using the graph algorithm here would be solving a problem this
data shape doesn't have, and would silently accept a data shape (multi-parent species)
that the domain says shouldn't exist.

### Why the UI is a flat list (Phase 5's pattern), not a tree (Phase 4's pattern)

Despite reusing Phase 4's tree *data model*, this phase reuses Phase 5's flat-list *UI*
pattern, not Phase 4's `WorldExplorerTree`. The reason is the same one
design-phase-5-technology.md section 3.1 gave for Technology: the tree here is not the
primary way a worldbuilder finds a species. A worldbuilder looks up "Elari" by name or
browses by classification, then inspects its parent/subspecies from its own detail view
— exactly Technology's "look it up, then inspect the graph on the detail view" pattern,
even though the underlying data shape (strict tree) matches Locations, not Technology
(a DAG). Data shape and navigation surface are orthogonal choices; Phase 6 takes Phase
4's answer to the first question and Phase 5's answer to the second.

`member_of` and `native_to` are ordinary N:N relationships (a location can be native to
more than one species; nothing about "belongs to a species" structurally caps at one
parent the way taxonomy does), so both reuse the `relationships` table directly, same
justification as Phase 4's `located_at` and Phase 5's `uses_technology`.

## 2. Backend (Rust) Structure

```
crates/loreforge-core/src/
  species.rs   - create/get/list/update/delete, mirroring locations.rs's shape almost
                 exactly (taxonomy plays the same structural role as location
                 hierarchy), plus:
                   - list_subspecies(conn, parent_id: Option<&str>) -> Vec<Species>
                     (direct children only; FR2.1 -- no ancestry-chain/breadcrumb
                     function, since Phase 6 doesn't need one: FR2.2 only asks for the
                     immediate parent's name, not a full breadcrumb, because there is no
                     tree-navigation UI to render a breadcrumb into)
                   - would_create_cycle(conn, id, candidate_parent_id) -> bool
                     (single-parent chain-walk, ported directly from
                     locations::would_create_cycle)
```

`species.rs::update` special-cases `parent_species_id` exactly as
`locations.rs::update` special-cases `parent_location_id`: before writing a new parent,
it walks the candidate parent's own ancestry looking for the species being moved,
rejecting the write as a cycle if found (FR3.3), validated inside the same transaction
as the update (NFR2).

`species.rs::delete` reparents direct subspecies to the deleted species' own parent (or
root) in the same transaction as the soft-delete and relationship cascade (FR3.1/FR3.2),
identical in shape to `locations.rs::delete`.

```
crates/loreforge-core/src/
  models.rs   - + Species, NewSpecies, SpeciesPatch, SpeciesFilter DTOs;
                SPECIES_CLASSIFICATIONS const; MEMBER_OF, NATIVE_TO relationship-type
                consts; extend DashboardMetrics with species_total /
                species_classifications_in_use
```

`src-tauri/src/commands.rs` gains: `list_species`, `get_species_entry`,
`create_species`, `update_species`, `delete_species`, `list_subspecies`.

(Note: `get_species` / `list_species` naming needs care since "species" is already
plural in English — the Tauri command for fetching a single species entity is named
`get_species_entry` to avoid the ambiguity `get_species` would otherwise read fine as
"get all species" or "get this one species." Internally the Rust module is still
`species::get`, `species::list`, etc.; only the Tauri command layer needs the
disambiguated name, since that's the surface where "singular vs. plural" actually
matters for a caller reading the command list.)

## 3. Frontend Structure

```
src/
  lib/
    types.ts           - + Species, NewSpecies, SpeciesPatch, SpeciesFilter,
                         SpeciesClassification, SPECIES_CLASSIFICATIONS, MEMBER_OF,
                         NATIVE_TO; extend DashboardMetrics
    tauri.ts / api.ts    - + api.species.{list,get,create,update,delete,listSubspecies}
    mockBackend.ts       - + mock species CRUD with the same reparent-on-delete and
                           single-parent cycle-rejection logic as Phase 4's mock
                           locations (not Phase 5's graph-cycle logic)
  hooks/
    useSpecies.ts        - useSpeciesList, useSpeciesEntry, useSubspecies + create/
                           update/delete mutations
  components/
    species/
      SpeciesList.tsx        - virtualized list + classification filter (reuses
                              TechnologyList.tsx's pattern directly)
      SpeciesDetail.tsx        - autosave fields (biology), classification <Select>,
                                "Set parent species..." picker (mirrors
                                TechnologyDependencies.tsx's picker shape, but for a
                                single-valued parent instead of a multi-valued
                                prerequisite list), read-only subspecies list
      SpeciesMembers.tsx         - member_of picker/list for characters (mirrors
                                  LocationRelations.tsx's located_at picker shape,
                                  narrowed to one source entity type)
      SpeciesHabitats.tsx        - native_to picker/list for locations
      EntitySpeciesLinks.tsx      - symmetric member_of/native_to display, wired into
                                   CharacterDetail.tsx (member_of) and
                                   LocationDetail.tsx (native_to)
  pages/
    SpeciesPage.tsx
```

### 3.1 The parent-species picker is single-valued, unlike Technology's prerequisites picker

`TechnologyDependencies.tsx` (Phase 5) manages a list of prerequisites, since a
technology can have several. `SpeciesDetail.tsx`'s parent-species picker is a single
`<select>` bound directly to `parent_species_id` via the same
`Option<Option<String>>`-shaped patch Phase 4's `LocationPatch.parent_location_id` and
Phase 5's `TechnologyPatch.introduced_date` already established (`Some(None)` clears the
parent back to root; `None` leaves it untouched) — there's no separate "add/remove edge"
step the way `requires` or `member_of` needs, because a species has at most one parent
at the data-model level, so setting it is just another autosaved field, not a
relationship-picker interaction. This is a smaller amount of UI than either Phase 4's
"Move to…" tree-aware picker or Phase 5's prerequisite-list picker, since there's no
tree UI to move something *within* and no list of edges to manage — just one optional
field.

### 3.2 Client-side cycle filtering in the parent-species picker

Mirroring Phase 4 section 3.2's approach (and reusing the exact same rationale, since
this is the same single-parent-tree cycle shape): the "Set parent species…" `<select>`
excludes the species itself and its own direct subspecies from the options client-side.
As with every phase before it, this is a UX nicety only; `species::update`'s backend
`would_create_cycle` check remains the authoritative guard.

### 3.3 `member_of` / `native_to` on Character/Location detail views (FR4.4)

Symmetric to Phase 4's `EntityLocationLinks.tsx` and Phase 5's
`EntityTechnologyLinks.tsx`, `EntitySpeciesLinks.tsx` reads relationships where the given
entity is the source (`member_of` for a character, `native_to` for a... wait, `native_to`
has the species as source, not the location — so for a location, this component instead
reads relationships where the location is the *target* and resolves the source species'
name, the mirror-image lookup direction from the character case). Reuses
`useRelationshipsForEntity` either way; no new data-fetching hook required, matching
every prior phase's integration-point pattern.

## 4. Dashboard Integration

Same pattern as every prior phase: `DashboardPage.tsx`'s "Species" entry moves from
`COMING_SOON_CARDS` to a live `MetricCard` fed by extended `DashboardMetrics` fields
(`species_total`, `species_classifications_in_use`).

## 5. Extensibility Notes for Future Phases

- Ships, Military, Politics, Organizations (future phases) can each link to Species via
  their own relationship types (e.g. a Military unit's "primarily crewed by" a species)
  without any change to `species_details` or the taxonomy functions.
- The future Universe Health Dashboard's population/demographics tracking (explicitly
  out of scope here) can layer numeric fields onto `species_details` or a new join
  table without disturbing the taxonomy tree, since population count is orthogonal to
  lineage.
- The future AI Continuity Checker could use `member_of` + a location's `native_to`
  species list to flag "this character's species isn't native to this location" as a
  soft consistency warning — this phase's structured relationships are what would make
  that check possible, though the checking logic itself remains out of scope until that
  phase.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no tree-navigation UI for taxonomy, no first-class
multi-species/hybrid-character affordance beyond allowing multiple `member_of` links,
no population/demographics tracking, no species-to-species relationship types beyond
`member_of`/`native_to`. The data model (`species_details` with a single nullable
`parent_species_id`, plus `member_of`/`native_to` relationships) is shaped so none of
these require a schema migration when they arrive.
