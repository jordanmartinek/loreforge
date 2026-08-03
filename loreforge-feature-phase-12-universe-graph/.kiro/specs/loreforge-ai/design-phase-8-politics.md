# LoreForge AI — Phase 8: Politics — Design

## 1. Data Model

```sql
-- New in Phase 8 --------------------------------------------------

CREATE TABLE political_entity_details (
  entity_id      TEXT PRIMARY KEY REFERENCES entities(id),
  classification TEXT NOT NULL DEFAULT 'other',
  ideology       TEXT NOT NULL DEFAULT '',
  founded_date   TEXT,
  date_precision TEXT NOT NULL DEFAULT 'day'
);
CREATE INDEX idx_political_entity_details_classification
  ON political_entity_details(classification);
```

Name lives on `entities.name`, `entity_type = 'political_entity'` — identical pattern to
every prior entity type. Four new `relationships.relationship_type` values, no schema
change:

```
'leads'        : character -> political_entity        (source leads target)
'controls'     : political_entity -> location          (source controls target as territory)
'allied_with'  : political_entity <-> political_entity (symmetric)
'rival_of'     : political_entity <-> political_entity (symmetric)
```

`leads` and `controls` are ordinary directional relationships, structurally identical to
Phase 6's `member_of`/`native_to` and Phase 7's `serves_in`/`stationed_at` — nothing new
there. `allied_with` and `rival_of` are new: the app's first **symmetric** relationship
types.

### 1.1 Symmetric relationships: enforced at the application layer, in a dedicated `politics.rs` helper

The `relationships` table has no notion of "symmetric" — every row still has a
`source_entity_id` and a `target_entity_id`. Symmetry is a property this phase's
application code enforces on top of that, the same way Phase 5 enforced "no cycles" on
top of an otherwise unremarkable table. Three rules, all validated inside one
transaction before the write commits:

1. **No duplicate in either direction.** Before inserting an `allied_with` edge between
   A and B, check for an existing `allied_with` row with `(source, target) = (A, B)` *or*
   `(B, A)`. If found, reject (FR3.2) rather than insert a second, redundant row.
2. **Mutual exclusivity between the two symmetric types.** Before inserting an
   `allied_with` edge, also check for an existing `rival_of` row between the same pair
   (either direction), and reject if found — and the mirror check when creating a
   `rival_of` edge (FR3.3).
3. **Resolving "the other side" is direction-agnostic.** `list_allies(conn, entity_id)`
   and `list_rivals(conn, entity_id)` both query for rows where `entity_id` is *either*
   the source or the target, and return whichever end of the row isn't `entity_id` — so
   it doesn't matter which political entity happened to initiate the link when it was
   created; both entities' detail views resolve their "other side" identically (FR3.4,
   NFR3).

This is implemented as `politics::create_symmetric_edge(conn, entity_a, entity_b,
relationship_type)` — a single function parameterized by relationship type (called once
for `allied_with`, once for `rival_of`), rather than two near-duplicate functions, since
the duplicate-check and mutual-exclusivity logic is identical for both types and only the
literal type string differs (unlike Phase 7's decision to keep `serves_in`/
`stationed_at`/`equipped_with` as three separate components, where each also needed a
different picker source — here there's no such divergence, so one parameterized function
is the right level of sharing).

`create_symmetric_edge` lives in `politics.rs`, not `relationships.rs`, for the same
reason Phase 5's `create_requires_edge` lives in `technologies.rs` and Phase 6/7's
cycle-checks live in `species.rs`/`military.rs`: the generic `relationships` module stays
unaware of any type-specific business rule, so it never has to be taught about cycles,
symmetry, or mutual exclusivity as new entity types accumulate their own relationship
rules. If a later phase needs a symmetric relationship on some other entity type, the
same `create_symmetric_edge` shape (or a lifted, doubly-generic version of it, once a
second real use case exists to design against — see Phase 7 design doc section 3.2's
"not yet, not never" reasoning for why this codebase prefers to wait for a second
concrete example before generalizing) is the template to reach for.

### 1.2 Why Politics has no taxonomy tree

Unlike Locations/Species/Military, this phase's data does not need a parent/child
hierarchy: a `political_entity` is not modeled as containing other `political_entity`s.
(Whether "The Meridian Senate" is part of "The Meridian Concord" is left to the
worldbuilder's own naming/description conventions for now — see Explicitly Out of Scope
in requirements-phase-8-politics.md.)
So `politics.rs` has no `parent_*_id` column, no chain-walk cycle check, and no
reparent-on-delete logic; it is a flatter, simpler module than `locations.rs`/
`species.rs`/`military.rs`, closer in shape to `technologies.rs` minus the dependency
graph (i.e., closest to `canon.rs`'s original shape from Phase 3).

## 2. Backend (Rust) Structure

```
crates/loreforge-core/src/
  politics.rs   - create/get/list/update/delete, mirroring canon.rs's flat shape
                  (no hierarchy, no dependency graph -- the simplest entity module
                  since Phase 3), plus:
                    - create_symmetric_edge(conn, entity_a, entity_b, relationship_type)
                      -> Result<Relationship>
                      Validates no-duplicate-either-direction and
                      mutual-exclusivity-with-the-opposite-type (section 1.1), then
                      delegates to relationships::create.
                    - list_allies(conn, entity_id) -> Result<Vec<PoliticalEntity>>
                    - list_rivals(conn, entity_id) -> Result<Vec<PoliticalEntity>>
                      Both direction-agnostic (section 1.1, point 3).
```

```
crates/loreforge-core/src/
  models.rs   - + PoliticalEntity, NewPoliticalEntity, PoliticalEntityPatch,
                PoliticalEntityFilter DTOs; POLITICAL_CLASSIFICATIONS const; LEADS,
                CONTROLS, ALLIED_WITH, RIVAL_OF relationship-type consts; extend
                DashboardMetrics with political_entities_total /
                political_classifications_in_use
```

`src-tauri/src/commands.rs` gains: `list_political_entities`, `get_political_entity`,
`create_political_entity`, `update_political_entity`, `delete_political_entity`,
`create_symmetric_edge` (takes a `relationship_type` parameter so one command covers
both `allied_with` and `rival_of`, mirroring the Rust function it wraps),
`list_political_allies`, `list_political_rivals`.

## 3. Frontend Structure

```
src/
  lib/
    types.ts           - + PoliticalEntity, NewPoliticalEntity, PoliticalEntityPatch,
                         PoliticalEntityFilter, PoliticalClassification,
                         POLITICAL_CLASSIFICATIONS, LEADS, CONTROLS, ALLIED_WITH,
                         RIVAL_OF; extend DashboardMetrics
    tauri.ts / api.ts    - + api.politics.{list,get,create,update,delete,
                           createSymmetricEdge,listAllies,listRivals}
    mockBackend.ts       - + mock political entity CRUD with the same
                           duplicate/mutual-exclusivity guarantees as the real backend
                           (wouldViolateSymmetricEdgeRules, mirroring
                           create_symmetric_edge's validation)
  hooks/
    usePolitics.ts       - usePoliticalEntities, usePoliticalEntity, useAllies,
                           useRivals + create/update/delete mutations +
                           useCreateSymmetricEdge
  components/
    politics/
      PoliticalEntityList.tsx      - virtualized list + classification filter (reuses
                                    SpeciesList.tsx's pattern)
      PoliticalEntityDetail.tsx      - autosave ideology field, classification
                                      <Select>, founded-date + precision fields
                                      (mirrors TechnologyDetail.tsx's
                                      introduced_date/date_precision fields),
                                      leader picker, territory picker, and a
                                      DiplomaticRelations section
      PoliticalLeadership.tsx          - leads picker/list for characters (mirrors
                                        SpeciesMembers.tsx/UnitPersonnel.tsx)
      PoliticalTerritory.tsx           - controls picker/list for locations (mirrors
                                        SpeciesHabitats.tsx/UnitStationing.tsx)
      DiplomaticRelations.tsx           - allied_with/rival_of picker + two lists
                                         (allies, rivals); this is new shape, not a
                                         copy of a prior phase's component, since no
                                         prior phase had a symmetric relationship to
                                         render (see section 3.1)
      EntityPoliticsLinks.tsx            - symmetric leads/controls display, wired
                                          into CharacterDetail.tsx (leads) and
                                          LocationDetail.tsx (controls)
  pages/
    PoliticsPage.tsx
```

### 3.1 `DiplomaticRelations.tsx` is new shape, not a copy

Every prior "linking" component (`SpeciesMembers`, `SpeciesHabitats`, `UnitPersonnel`,
`UnitStationing`, `UnitEquipment`) has one picker and one resulting list, because their
relationship type is directional and the component only ever manages one direction from
one entity's point of view. `DiplomaticRelations.tsx` needs two lists (allies, rivals)
fed by two different queries (`useAllies`, `useRivals`) but a *shared* picker whose
"relationship type" is chosen by which of two buttons the user clicks ("Mark as ally" /
"Mark as rival"), since both actions link to the same kind of target (another political
entity) and only the semantics differ. Rejections from FR3.3 (attempting to ally with an
existing rival, or vice versa) surface as a normal mutation error via the existing
`useSaveStatusStore` error surface — no new error-display mechanism, consistent with how
every prior phase's business-rule rejections (cycles, etc.) have surfaced.

### 3.2 `EntityPoliticsLinks.tsx` takes a two-way mode, like Phase 6's, not Phase 7's three-way

Only `leads` (character-side) and `controls` (location-side) need symmetric-visibility
display on another entity type's detail view — `allied_with`/`rival_of` are between two
political entities and are already fully rendered by `DiplomaticRelations.tsx` on the
political entity's own detail view, so there's no third "mode" the way Phase 7 needed one
for `equipped_with`. `EntityPoliticsLinks.tsx` takes `mode: "leadership" | "territory"`,
directly mirroring Phase 6's `EntitySpeciesLinks.tsx` two-way shape rather than Phase 7's
three-way one.

## 4. Dashboard Integration

Same pattern as every prior phase: `DashboardPage.tsx`'s "Politics" entry moves from
`COMING_SOON_CARDS` to a live `MetricCard` fed by extended `DashboardMetrics` fields
(`political_entities_total`, `political_classifications_in_use`). As with Phase 7's
lesson learned, double-check the Coming-Soon list is edited in the same change so no
duplicate card is left behind.

## 5. Extensibility Notes for Future Phases

- Religions/Organizations (future phases, per the brief) can each decide independently
  whether they need a symmetric relationship of their own (e.g. "schism from" between two
  religions) — if so, `create_symmetric_edge`'s shape is directly reusable, likely lifted
  into a small generic helper once a second concrete case exists to design its type
  parameter against (per section 1.1's "wait for a second example" reasoning).
- If a future phase decides Politics *does* need a containment hierarchy after all (e.g.
  a Franchise Planner phase wanting to model federations of member states), it can add a
  `parent_entity_id` column to `political_entity_details` and reuse the by-now
  three-times-written chain-walk cycle-check pattern, without disturbing this phase's
  flat data model or its symmetric-edge logic.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no political-entity taxonomy/containment hierarchy, no
elections/succession/term-of-office tracking beyond what Revision History already
captures, no Laws/Legislation entity type, no symmetric relationships for any entity type
other than political entities. The data model (`political_entity_details` with no
self-referential column, plus `leads`/`controls`/`allied_with`/`rival_of`
relationships) is shaped so none of these require a schema migration when they arrive.
