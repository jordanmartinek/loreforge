# LoreForge AI — Phase 9: Religions — Design

## 1. The `hierarchy.rs` extraction

### 1.1 Shape of the extracted helper

```rust
// crates/loreforge-core/src/hierarchy.rs

/// Returns true if setting `candidate_id`'s parent to `new_parent_id`
/// would make `candidate_id` its own ancestor -- i.e. `new_parent_id` is
/// `candidate_id` itself, or one of `candidate_id`'s own descendants.
/// `get_parent_id` is however the caller looks up a given node's current
/// parent (a closure over that entity type's own `get()` function).
pub fn would_create_cycle<F>(
    candidate_id: &str,
    new_parent_id: &str,
    mut get_parent_id: F,
) -> bool
where
    F: FnMut(&str) -> Option<String>,
{
    if candidate_id == new_parent_id {
        return true;
    }

    let mut seen = std::collections::HashSet::new();
    let mut current = Some(new_parent_id.to_string());

    while let Some(id) = current {
        if id == candidate_id {
            return true;
        }
        if !seen.insert(id.clone()) {
            break; // pre-existing cycle elsewhere; don't loop forever
        }
        current = get_parent_id(&id);
    }

    false
}
```

Each caller becomes a one-line wrapper:

```rust
// locations.rs
pub fn would_create_cycle(conn: &Connection, candidate_id: &str, new_parent_id: &str) -> Result<bool> {
    Ok(hierarchy::would_create_cycle(candidate_id, new_parent_id, |id| {
        get(conn, id).ok().and_then(|l| l.parent_location_id)
    }))
}
```

`species.rs`/`military.rs`/`religions.rs` get the identical shape, swapping `get` and
`parent_location_id` for their own type's `get`/`parent_*_id`. The closure captures
`conn` by reference, so the generic function itself never needs to know about
`rusqlite::Connection` at all — it operates purely on `&str` ids and an
id-to-parent-id lookup function, making it trivially testable in isolation (though per
NFR3, this phase doesn't add new direct tests for `hierarchy::would_create_cycle`
itself, since the four callers' existing test suites already fully exercise every
reachable code path: direct self-parent, immediate-parent cycle, deep multi-level
cycle, and the false/no-cycle case).

### 1.2 Why now, and why this doesn't also absorb Phase 5's or Phase 8's business rules

Phase 7's design doc (section 3.2) deferred this extraction, reasoning that two examples
(`locations.rs`, `species.rs`) weren't enough to design a generic shape against with
confidence, and that it would wait for a second data point before generalizing further.
By the time Religions arrives, there are three real examples
(`locations.rs`/`species.rs`/`military.rs`), all with the *exact* same algorithm and
only naming differences — which is exactly the "enough real variation to design
against" threshold Phase 7 set as the condition for revisiting this. In this case
"enough variation" turned out to mean "confirming there's no variation at all" across
three independent implementations, which is itself useful information: it means the
generic version can be a straight lift of the existing code with a closure parameter,
not a redesign.

This extraction deliberately does **not** also try to unify with:
- **Phase 5's technology dependency graph** (`technologies::would_create_cycle`) — that
  function solves a different problem (a node can have *multiple* parents/prerequisites,
  requiring a BFS over all outgoing edges, not a single-parent walk). Folding it into
  the same helper would require the single-parent callers to pay for multi-parent BFS
  machinery they don't need, or the helper to grow a mode flag distinguishing the two
  algorithms — either of which makes the shared code harder to read than four small
  call sites, which is precisely the trade-off Phase 5's design doc already rejected
  when it kept `create_requires_edge` out of the generic `relationships` module.
- **Phase 8's symmetric-edge validation** (`politics::create_symmetric_edge`) — a
  completely different shape of business rule (edge deduplication + mutual exclusivity
  between two relationship types, not a tree-cycle check). There is no meaningful shared
  code between it and `hierarchy::would_create_cycle`.

So this phase extracts exactly one thing — the single-parent chain-walk — because
that's the one piece that has now been independently reimplemented three times with
zero meaningful variation. Everything else stays as its own dedicated, purpose-built
function, consistent with this codebase's running principle (stated explicitly in the
Phase 5, 7, and 8 design docs) of not generalizing until a genuine, repeated pattern is
in hand.

### 1.3 Reparent-on-delete is *not* extracted

Only the cycle-check chain-walk is shared. Each entity type's `delete()` function still
has its own few lines of "reparent direct children to my own parent" logic, because
that logic is trivially a single `UPDATE ... SET parent_x_id = ?1 WHERE parent_x_id =
?2` statement differing only by table/column name — extracting *that* into a generic
helper would trade three readable one-line SQL statements for a function needing to
know the table name, the parent-column name, and the entity type string, which is more
ceremony than the thing it replaces. The chain-walk cycle-check earns extraction because
it's ~15 lines of actual algorithm; the reparent-on-delete doesn't, because it's one SQL
statement.

## 2. Religion Data Model

```sql
-- New in Phase 9 --------------------------------------------------

CREATE TABLE religion_details (
  entity_id          TEXT PRIMARY KEY REFERENCES entities(id),
  classification     TEXT NOT NULL DEFAULT 'other',
  tenets             TEXT NOT NULL DEFAULT '',
  parent_religion_id TEXT REFERENCES entities(id) -- NULL = root tradition
);
CREATE INDEX idx_religion_details_parent ON religion_details(parent_religion_id);
CREATE INDEX idx_religion_details_classification ON religion_details(classification);
```

Name lives on `entities.name`, `entity_type = 'religion'`. Two new
`relationships.relationship_type` values, no schema change:

```
'follows'    : character -> religion   (source follows target)
'holy_site'  : religion -> location    (source considers target a holy site)
```

Both are ordinary directional relationships, structurally identical to Phase 6's
`member_of`/`native_to`, Phase 7's `serves_in`/`stationed_at`, and Phase 8's
`leads`/`controls` — nothing new there; the only genuinely new work this phase does at
the data-model level is the `hierarchy.rs` extraction (section 1).

## 3. Backend (Rust) Structure

```
crates/loreforge-core/src/
  hierarchy.rs   - NEW: generic would_create_cycle (section 1.1)
  locations.rs   - REFACTORED: would_create_cycle now delegates to hierarchy::*
  species.rs     - REFACTORED: same
  military.rs    - REFACTORED: same
  religions.rs   - NEW: create/get/list/update/delete mirroring species.rs's/
                   military.rs's shape, `list_schisms`, `would_create_cycle`
                   (delegates to hierarchy:: from day one -- no copy ever written)
```

```
crates/loreforge-core/src/
  models.rs   - + Religion, NewReligion, ReligionPatch, ReligionFilter DTOs;
                RELIGION_CLASSIFICATIONS const; FOLLOWS, HOLY_SITE relationship-type
                consts; extend DashboardMetrics with religions_total /
                religion_classifications_in_use
```

`src-tauri/src/commands.rs` gains: `list_religions`, `get_religion`, `create_religion`,
`update_religion`, `delete_religion`, `list_schisms`.

## 4. Frontend Structure

```
src/
  lib/
    types.ts           - + Religion, NewReligion, ReligionPatch, ReligionFilter,
                         ReligionClassification, RELIGION_CLASSIFICATIONS, FOLLOWS,
                         HOLY_SITE; extend DashboardMetrics
    tauri.ts / api.ts    - + api.religions.{list,get,create,update,delete,listSchisms}
    mockBackend.ts       - + mock religion CRUD with the same reparent-on-delete +
                           single-parent cycle-rejection guarantees as the real
                           backend. The frontend mock layer has no equivalent
                           refactor to do here (mockBackend.ts's per-entity cycle
                           helpers -- wouldCreateLocationCycle,
                           wouldCreateSpeciesCycle, wouldCreateMilitaryUnitCycle --
                           are three tiny standalone functions in one file already;
                           unlike the Rust side, there's no cross-module duplication
                           to clean up, so this phase adds a fourth
                           `wouldCreateReligionCycle` alongside them rather than
                           introducing a parallel frontend refactor that has no
                           backend-side motivating problem to solve)
  hooks/
    useReligions.ts      - useReligions/useReligion/useSchisms + create/update/delete
                           mutations
  components/
    religions/
      ReligionList.tsx        - virtualized list + classification filter (reuses
                               MilitaryUnitList.tsx's pattern)
      ReligionDetail.tsx        - autosave tenets field, classification <Select>,
                                 single-valued "Set parent religion…" picker
                                 (mirrors SpeciesDetail.tsx/MilitaryUnitDetail.tsx's
                                 parent picker shape), read-only schisms list
      ReligionFollowers.tsx      - follows picker/list for characters (mirrors
                                  SpeciesMembers.tsx/UnitPersonnel.tsx/
                                  PoliticalLeadership.tsx)
      ReligionHolySites.tsx      - holy_site picker/list for locations (mirrors
                                  SpeciesHabitats.tsx/UnitStationing.tsx/
                                  PoliticalTerritory.tsx)
      EntityReligionLinks.tsx     - symmetric follows/holy_site display, two-way
                                   `mode` prop ("follower" | "holySite"), wired into
                                   CharacterDetail.tsx (follower) and
                                   LocationDetail.tsx (holySite) -- mirrors Phase 6's
                                   EntitySpeciesLinks.tsx two-way shape exactly
  pages/
    ReligionsPage.tsx
```

By this point (the fourth tree-shaped, two-directional-relationship entity type in a
row after Species and Military, following Politics' flat interlude), every piece of
this phase's frontend is a direct, mechanical application of an already-established
pattern with no new UI shape to design — the interesting work this phase is entirely on
the Rust side (section 1).

## 5. Dashboard Integration

Same pattern as every prior phase: `DashboardPage.tsx`'s "Religions" entry moves from
`COMING_SOON_CARDS` to a live `MetricCard`. Per Phase 8's proactively-applied lesson,
the stale Coming-Soon entry is checked for and removed in the same change, not caught
reactively via a test failure.

## 6. Extensibility Notes for Future Phases

- Organizations (a future phase per the brief) will very likely be the fifth
  tree-or-flat entity type; whichever shape it turns out to need, `hierarchy.rs` (if
  tree-shaped) or Politics' flat pattern (if not) are both now established, reusable
  templates.
- If a future phase needs deity/pantheon-member sub-entities within a religion (out of
  scope here per requirements.md), that would likely be its own entity type linked to
  `religion` via a new relationship type, not a change to `religion_details`.

## 7. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no schism-tree-navigation UI, no deity/pantheon
sub-entity modeling, no clergy rank/hierarchy-of-office tracking, no structured
schism-cause modeling beyond free-text `tenets`. The `hierarchy.rs` extraction is scoped
to exactly the single-parent chain-walk (section 1.2) and does not attempt to also
unify Phase 5's graph-cycle logic or Phase 8's symmetric-edge validation.
