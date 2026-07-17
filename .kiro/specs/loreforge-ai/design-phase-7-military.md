# LoreForge AI — Phase 7: Military — Design

## 1. Data Model

```sql
-- New in Phase 7 --------------------------------------------------

CREATE TABLE military_unit_details (
  entity_id      TEXT PRIMARY KEY REFERENCES entities(id),
  branch         TEXT NOT NULL DEFAULT 'other',
  doctrine       TEXT NOT NULL DEFAULT '',
  parent_unit_id TEXT REFERENCES entities(id) -- NULL = top of chain of command
);
CREATE INDEX idx_military_unit_details_parent ON military_unit_details(parent_unit_id);
CREATE INDEX idx_military_unit_details_branch ON military_unit_details(branch);
```

Name lives on `entities.name`, `entity_type = 'military_unit'` — identical pattern to
every prior entity type. Three new `relationships.relationship_type` values, no schema
change:

```
'serves_in'      : character -> military_unit  (source serves in target)
'stationed_at'   : military_unit -> location   (source is stationed at target)
'equipped_with'  : military_unit -> technology  (source is equipped with target)
```

### Why chain of command is a column (Phase 4/6's pattern), not a graph (Phase 5's pattern)

This is the same question Phase 6's design doc opened with, and it has the same answer:
a chain of command is a strict tree. A company reports to exactly one battalion; it
cannot simultaneously report to two different battalions without that being modeled as
a reorganization (a point-in-time change to `parent_unit_id`), not a standing dual
membership. That's structurally identical to Phase 4's location containment and Phase
6's species taxonomy, and unlike Phase 5's technology dependency graph. So
`military_unit_details.parent_unit_id` is a dedicated nullable self-referential column,
and `military.rs` reuses the same chain-walk `would_create_cycle` and
reparent-on-delete logic already written twice now (`locations.rs`, `species.rs`),
rather than Phase 5's graph-BFS.

By this third occurrence, the chain-walk cycle-check and reparent-on-delete logic is
copy-pasted nearly verbatim for a third time (`locations.rs` -> `species.rs` ->
`military.rs`), with only the column/table names changing. This repetition is a
deliberate, documented trade-off, not an oversight — see section 3.2 for why this phase
does not extract it into a shared generic module.

### Why the UI is a flat list (Phase 5/6's pattern), not a tree (Phase 4's pattern)

Same reasoning as Phase 6 section on this topic: despite reusing Phase 4's tree *data
model*, Military's UI reuses Phase 5's flat-list *UI* pattern. A worldbuilder looks up
"3rd Company" by name or browses by branch, then inspects its place in the chain of
command from its own detail view — the tree is not the primary navigation surface.

`serves_in`, `stationed_at`, and `equipped_with` are ordinary N:N relationships (a
location can have more than one unit stationed there; a unit can be equipped with more
than one technology), so all three reuse the `relationships` table directly, same
justification as every prior phase's non-tree relationship types.

## 2. Backend (Rust) Structure

```
crates/loreforge-core/src/
  military.rs   - create/get/list/update/delete, mirroring species.rs's shape almost
                  exactly (chain of command plays the same structural role as
                  taxonomy/location hierarchy), plus:
                    - list_subordinate_units(conn, parent_id: Option<&str>) -> Vec<MilitaryUnit>
                      (direct children only; FR2.1)
                    - would_create_cycle(conn, id, candidate_parent_id) -> bool
                      (single-parent chain-walk, ported directly from
                      species::would_create_cycle, which was itself ported from
                      locations::would_create_cycle)
```

### 3.1 On the "one relationship-links component per linked type" pattern reaching a third link type

Phases 4-6 each introduced exactly one non-tree relationship type per phase (Phase 4:
`located_at`; Phase 5: `uses_technology`; Phase 6: `member_of` + `native_to`, which was
already two). Military introduces three (`serves_in`, `stationed_at`,
`equipped_with`) on a single entity type's detail view simultaneously. This phase
considered, and rejected, generalizing this into a single configurable
"RelationshipLinksSection" component parameterized by relationship type + target entity
type + direction, on the grounds that:

- Each of the three integration points needs a different picker source (all characters
  for `serves_in`, all locations for `stationed_at`, all technologies for
  `equipped_with`), so a generic component would need a "which list to fetch" parameter
  anyway — at which point it is not meaningfully simpler than three small, readable
  components, each of which already has a close analog to copy from
  (`SpeciesMembers.tsx` for the character-linking shape, `SpeciesHabitats.tsx` for the
  unit-is-source-linking-to-a-location shape).
- Two of the three phases-of-copying so far (locations -> technology -> species) have
  each had a *different* enough shape (tree vs. graph vs. tree-with-two-link-types)
  that a premature generic abstraction risked either being wrong for the next phase's
  variant or accumulating configuration flags nobody could read. Three concrete,
  boring components remain easier to review and modify independently than one generic,
  parameterized one.
- This is a "not yet" decision, not a "never" one: if Phase 8 or later introduces a
  fourth or fifth link-type-per-entity phase, that would be the point to actually build
  the generic component, once there's enough real variation on the table to design its
  parameters against actual cases instead of guessed ones.

So `military.rs`/the frontend gets three small, parallel components:
`UnitPersonnel.tsx` (serves_in, mirrors `SpeciesMembers.tsx`), `UnitStationing.tsx`
(stationed_at, mirrors `SpeciesHabitats.tsx`'s "this entity is the relationship source"
shape), and `UnitEquipment.tsx` (equipped_with, same shape as `UnitStationing.tsx` but
targeting technology instead of location).

### 3.2 Why the chain-walk logic still isn't extracted into a shared module, on its third copy

`would_create_cycle` and the reparent-on-delete transaction body are now duplicated
three times (`locations.rs`, `species.rs`, `military.rs`), differing only in table/column
names (`location`/`parent_location_id`, `species`/`parent_species_id`,
`military_unit`/`parent_unit_id`) and the DTO type returned. A generic
`fn would_create_cycle_generic<T>(...)` was considered and rejected for this phase for
the same reason Phase 5's design doc gave for not teaching `relationships::create` about
type-specific rules: each of the three modules' `get()` function has a different SQL
shape (different table joins, different DTO), so a fully generic version would need a
closure or trait parameter for "how do I fetch this row's parent id", which is more
indirection than the ~15 lines of straightforward chain-walk code it would replace. If a
fourth tree-shaped entity type arrives in a later phase, three real examples (rather
than two) would be enough to design a genuinely useful shared helper against, rather
than guessing its shape from two. Documented here explicitly so a future phase doesn't
have to rediscover this reasoning from scratch — and so a reviewer doesn't mistake three
near-identical files for an accidental oversight.

```
crates/loreforge-core/src/
  models.rs   - + MilitaryUnit, NewMilitaryUnit, MilitaryUnitPatch, MilitaryUnitFilter
                DTOs; MILITARY_BRANCHES const; SERVES_IN, STATIONED_AT, EQUIPPED_WITH
                relationship-type consts; extend DashboardMetrics with
                military_units_total / military_branches_in_use
```

`src-tauri/src/commands.rs` gains: `list_military_units`, `get_military_unit`,
`create_military_unit`, `update_military_unit`, `delete_military_unit`,
`list_subordinate_units`. (Unlike Phase 6's `get_species_entry` naming workaround,
"military unit" is already unambiguously singular, so `get_military_unit` reads fine
without disambiguation.)

## 3. Frontend Structure

```
src/
  lib/
    types.ts           - + MilitaryUnit, NewMilitaryUnit, MilitaryUnitPatch,
                         MilitaryUnitFilter, MilitaryBranch, MILITARY_BRANCHES,
                         SERVES_IN, STATIONED_AT, EQUIPPED_WITH; extend DashboardMetrics
    tauri.ts / api.ts    - + api.military.{list,get,create,update,delete,
                           listSubordinateUnits}
    mockBackend.ts       - + mock military CRUD with the same reparent-on-delete and
                           single-parent cycle-rejection logic as Phase 4/6's mock
                           locations/species (not Phase 5's graph-cycle logic)
  hooks/
    useMilitary.ts       - useMilitaryUnits, useMilitaryUnit, useSubordinateUnits +
                           create/update/delete mutations
  components/
    military/
      MilitaryUnitList.tsx      - virtualized list + branch filter (reuses
                                 SpeciesList.tsx's pattern directly)
      MilitaryUnitDetail.tsx      - autosave doctrine field, branch <Select>,
                                   single-valued "Set parent unit…" picker (mirrors
                                   SpeciesDetail.tsx's parent-species picker shape),
                                   read-only subordinate-units list
      UnitPersonnel.tsx            - serves_in picker/list for characters (mirrors
                                    SpeciesMembers.tsx)
      UnitStationing.tsx           - stationed_at picker/list for locations (mirrors
                                    SpeciesHabitats.tsx)
      UnitEquipment.tsx            - equipped_with picker/list for technologies (same
                                    shape as UnitStationing.tsx, different target type)
      EntityMilitaryLinks.tsx       - symmetric serves_in/stationed_at/equipped_with
                                     display, wired into CharacterDetail.tsx
                                     (serves_in), LocationDetail.tsx (stationed_at), and
                                     TechnologyDetail.tsx (equipped_with)
  pages/
    MilitaryPage.tsx
```

### 3.3 `EntityMilitaryLinks.tsx` needs a three-way mode, not Phase 6's two-way one

Phase 6's `EntitySpeciesLinks.tsx` took a `mode: "member" | "habitat"` prop because
`member_of` and `native_to` point in different directions relative to the linked entity.
Military needs a third mode, `"equipment"`, for the technology side (`equipped_with`
has the unit as source, the technology as target — same lookup direction as `"habitat"`,
just against the `equipped_with` relationship type and a different target-type resolver).
So `EntityMilitaryLinks.tsx` takes `mode: "personnel" | "stationing" | "equipment"`,
directly extending Phase 6's pattern rather than inventing a new one.

### 3.4 Client-side cycle filtering in the parent-unit picker

Mirroring Phase 6 section 3.2 (itself mirroring Phase 4 section 3.2): the "Set parent
unit…" `<select>` excludes the unit itself and its own direct subordinate units from the
options client-side, as a UX nicety only. `military::update`'s backend
`would_create_cycle` check remains the authoritative guard.

## 4. Dashboard Integration

Same pattern as every prior phase: `DashboardPage.tsx`'s "Military" entry moves from
`COMING_SOON_CARDS` to a live `MetricCard` fed by extended `DashboardMetrics` fields
(`military_units_total`, `military_branches_in_use`).

## 5. Extensibility Notes for Future Phases

- Ships (future phase, if modeled as its own entity type rather than a Technology
  subtype) could link to Military units via a new relationship type without touching
  `military_unit_details`.
- Politics/Organizations (future phases) could add unit-to-unit relationships (allied
  with / at war with) as new relationship types on the existing `relationships` table,
  same as this phase added three new types without a schema change.
- The future Universe Health Dashboard's personnel-strength tracking (explicitly out of
  scope here) can layer a numeric field onto `military_unit_details` without disturbing
  the chain-of-command tree, exactly as Phase 6 noted for species population tracking.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no chain-of-command tree-navigation UI, no
rank/personnel-count tracking, no unit-to-unit relationship types beyond chain of
command, no battle/combat-event modeling beyond what the existing generic
`relationships` table already supports, no distinct Ships entity type. The data model
(`military_unit_details` with a single nullable `parent_unit_id`, plus
`serves_in`/`stationed_at`/`equipped_with` relationships) is shaped so none of these
require a schema migration when they arrive.
