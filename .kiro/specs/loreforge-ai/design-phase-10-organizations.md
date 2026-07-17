# LoreForge AI — Phase 10: Organizations — Design

## 1. The `symmetric.rs` extraction

### 1.1 Shape of the extracted helper

```rust
// crates/loreforge-core/src/symmetric.rs

/// Finds an existing edge of `relationship_type` between `a` and `b`, in
/// either direction. Returns the relationship id if found.
fn find_edge_either_direction(
    conn: &Connection,
    a: &str,
    b: &str,
    relationship_type: &str,
) -> Result<Option<String>> { /* identical to politics.rs's private helper */ }

/// Creates a symmetric edge of `relationship_type` between `a` and `b`,
/// rejecting: a self-link; a duplicate of `relationship_type` in either
/// direction; or an existing edge of `opposite_type` in either direction
/// (the two types are mutually exclusive with each other, e.g.
/// ALLIED_WITH/RIVAL_OF or ORG_ALLIED_WITH/ORG_RIVAL_OF).
pub fn create_symmetric_edge(
    conn: &Connection,
    a: &str,
    b: &str,
    relationship_type: &str,
    opposite_type: &str,
) -> Result<Relationship> { /* ... */ }

/// The ids linked to `entity_id` via `relationship_type`, direction-
/// agnostic. Returns raw ids, NOT full records -- callers resolve full
/// records themselves (`politics::get`, `organizations::get`, etc.),
/// since this module has no knowledge of any specific entity type's
/// table.
pub fn list_symmetric_link_ids(
    conn: &Connection,
    entity_id: &str,
    relationship_type: &str,
) -> Result<Vec<String>> { /* ... */ }
```

Each caller becomes a thin wrapper that supplies its own two relationship-type
constants and its own `get()` for resolving full records:

```rust
// organizations.rs
pub fn create_symmetric_edge(conn: &Connection, a: &str, b: &str, relationship_type: &str) -> Result<Relationship> {
    let opposite = if relationship_type == ORG_ALLIED_WITH { ORG_RIVAL_OF } else { ORG_ALLIED_WITH };
    symmetric::create_symmetric_edge(conn, a, b, relationship_type, opposite)
}

pub fn list_allies(conn: &Connection, entity_id: &str) -> Result<Vec<Organization>> {
    symmetric::list_symmetric_link_ids(conn, entity_id, ORG_ALLIED_WITH)?
        .into_iter()
        .map(|id| get(conn, &id))
        .collect()
}
```

### 1.2 Why extract after two data points here, but four for `hierarchy.rs`

Phase 9's `hierarchy.rs` extraction deliberately waited for a fourth independent
implementation before generalizing, reasoning that the single-parent chain-walk might
have had real, undiscovered variation across call sites that only enough repetition
would reveal. By the fourth copy, there was demonstrably zero variation (see
design-phase-9-religions.md section 1.2), which retroactively validated waiting.

This phase's situation is different in a way that changes the right threshold:
Phase 8's `create_symmetric_edge`/`list_allies`/`list_rivals` were **already written
generically with respect to relationship type** — the function took the relationship
type as a runtime parameter (`ALLIED_WITH` vs. `RIVAL_OF`) rather than being duplicated
once per type, which is exactly the generalization `hierarchy.rs` needed four data
points to discover was safe. The only thing tying Phase 8's implementation to Politics
specifically was (a) the two hardcoded relationship-type constants and (b) which
table's `get()` it called to resolve a full record. Both of those are trivial,
mechanical parameters to add — there's no risk of discovering "actually, alliance
validation works differently for organizations" the way there might have been a risk of
discovering "actually, chain-of-command cycle detection works differently for military
units" (it didn't, but that wasn't obvious a priori the way it is here). So two data
points is enough this time: the first (Politics) already had the right shape, and the
second (Organizations) just confirms the shape generalizes over "which two relationship
types" and "which entity's table," which is all it ever needed to generalize over.

This is not a contradiction of Phase 9's reasoning — it's the same underlying
principle (don't generalize until you have enough real examples to be confident there's
no variation) applied with a correctly different threshold, because the amount of
*prior* generality already built into each piece of duplicated logic differs. A
premature abstraction risk is about hidden variation, not about a fixed number of
repetitions; Phase 8's code had already resolved most of the variation risk by taking
relationship type as a parameter, so extracting after its second use is not "the same
mistake as extracting `hierarchy.rs` after two" — the two pieces of logic started from
different levels of genericity.

### 1.3 Why relationship-type strings stay per-entity-type, not shared globally

`ALLIED_WITH`/`RIVAL_OF` (Politics) and `ORG_ALLIED_WITH`/`ORG_RIVAL_OF` (Organizations)
are deliberately distinct relationship-type strings, not a single shared
`ALLIED_WITH` reused across entity types. Two political entities being allied and two
organizations being allied are different facts in the worldbuilder's data even though
the *validation logic* for both is identical (which is what `symmetric.rs` shares).
Sharing the relationship-type string itself would conflate "these two political
entities are allied" and "these two organizations are allied" if, hypothetically, an id
collision or a future cross-type query ever needed to distinguish them — keeping them
separate costs nothing (they're just different string constants) and avoids that risk
entirely. This mirrors how `MEMBER_OF` (Phase 6, species) and `SERVES_IN` (Phase 7,
military) are separate constants even though both are "a character belongs to
something" in spirit.

## 2. Organization Data Model

```sql
-- New in Phase 10 -------------------------------------------------

CREATE TABLE organization_details (
  entity_id              TEXT PRIMARY KEY REFERENCES entities(id),
  classification         TEXT NOT NULL DEFAULT 'other',
  charter                TEXT NOT NULL DEFAULT '',
  parent_organization_id TEXT REFERENCES entities(id) -- NULL = no parent org
);
CREATE INDEX idx_organization_details_parent ON organization_details(parent_organization_id);
CREATE INDEX idx_organization_details_classification ON organization_details(classification);
```

Name lives on `entities.name`, `entity_type = 'organization'`. Four new
`relationships.relationship_type` values, no schema change:

```
'affiliated_with' : character -> organization        (source is affiliated with target)
'operates_at'      : organization -> location          (source operates out of target)
'org_allied_with'  : organization <-> organization     (symmetric)
'org_rival_of'     : organization <-> organization     (symmetric)
```

`affiliated_with` and `operates_at` are ordinary directional relationships,
structurally identical to every prior phase's non-tree relationship types — nothing new
there. `org_allied_with`/`org_rival_of` consume the newly-shared `symmetric.rs` (section
1). `parent_organization_id` is the fifth entity type to use `hierarchy.rs`'s cycle
check (after Locations, Species, Military, Religions) — also nothing new to design.

## 3. Backend (Rust) Structure

```
crates/loreforge-core/src/
  symmetric.rs         - NEW: generic create_symmetric_edge / list_symmetric_link_ids
                         (section 1.1)
  politics.rs          - REFACTORED: create_symmetric_edge/list_allies/list_rivals now
                         thin wrappers delegating to symmetric::*
  organizations.rs     - NEW: create/get/list/update/delete mirroring religions.rs's
                         shape, `list_subsidiaries` (delegates to hierarchy:: from day
                         one, per Phase 9's precedent), `create_symmetric_edge`/
                         `list_org_allies`/`list_org_rivals` (delegate to symmetric::
                         from day one)
```

```
crates/loreforge-core/src/
  models.rs   - + Organization, NewOrganization, OrganizationPatch, OrganizationFilter
                DTOs; ORGANIZATION_CLASSIFICATIONS const; AFFILIATED_WITH, OPERATES_AT,
                ORG_ALLIED_WITH, ORG_RIVAL_OF relationship-type consts; extend
                DashboardMetrics with organizations_total /
                organization_classifications_in_use
```

`src-tauri/src/commands.rs` gains: `list_organizations`, `get_organization`,
`create_organization`, `update_organization`, `delete_organization`,
`list_subsidiaries`, `create_org_symmetric_edge`, `list_org_allies`, `list_org_rivals`.
(Named distinctly from Politics' `create_symmetric_edge` command since Tauri commands
are registered in one flat global namespace across the whole app, unlike Rust module
functions which are namespaced by module path.)

## 4. Frontend Structure

```
src/
  lib/
    types.ts           - + Organization, NewOrganization, OrganizationPatch,
                         OrganizationFilter, OrganizationClassification,
                         ORGANIZATION_CLASSIFICATIONS, AFFILIATED_WITH, OPERATES_AT,
                         ORG_ALLIED_WITH, ORG_RIVAL_OF; extend DashboardMetrics
    tauri.ts / api.ts    - + api.organizations.{list,get,create,update,delete,
                           listSubsidiaries,createSymmetricEdge,listAllies,listRivals}
    mockBackend.ts       - + mock organization CRUD with the same reparent-on-delete +
                           cycle-rejection guarantees (delegates to the existing
                           wouldCreate*Cycle-style helper, generalized slightly -- see
                           section 4.1) and the same symmetric-edge dedup/mutual-
                           exclusivity guarantees as Politics' mock, reusing a
                           generalized `createMockSymmetricEdge`/`listMockSymmetricLinks`
                           pair instead of a third copy-pasted implementation
  hooks/
    useOrganizations.ts  - useOrganizations/useOrganization/useSubsidiaries/
                           useOrgAllies/useOrgRivals + create/update/delete mutations +
                           useCreateOrgSymmetricEdge
  components/
    organizations/
      OrganizationList.tsx      - virtualized list + classification filter
      OrganizationDetail.tsx      - autosave charter field, classification <Select>,
                                   single-valued "Set parent organization…" picker,
                                   read-only subsidiaries list
      OrganizationMembers.tsx      - affiliated_with picker/list for characters
      OrganizationLocations.tsx    - operates_at picker/list for locations
      OrgDiplomaticRelations.tsx    - allied/rival picker + two lists, generalized
                                     from Phase 8's DiplomaticRelations.tsx (see
                                     section 4.2)
      EntityOrganizationLinks.tsx   - symmetric affiliated_with/operates_at display,
                                     two-way `mode` prop
  pages/
    OrganizationsPage.tsx
```

### 4.1 Frontend mock-backend cycle helpers: still not generalized

Unlike the Rust side, `mockBackend.ts`'s four `wouldCreate*Cycle` functions
(`wouldCreateLocationCycle`, `wouldCreateSpeciesCycle`, `wouldCreateMilitaryUnitCycle`,
`wouldCreateReligionCycle`) were never unified even after Phase 9's Rust-side
extraction, because Phase 9's design doc (section 4) already decided the frontend mock
layer has no cross-module duplication problem to solve — they're four tiny standalone
functions in one file, not four separate files each reimplementing the algorithm. Phase
10 adds a fifth (`wouldCreateOrganizationCycle`) the same way, for the same reason.

### 4.2 Generalizing `DiplomaticRelations.tsx` into `OrgDiplomaticRelations.tsx`

Rather than duplicating Phase 8's `DiplomaticRelations.tsx` wholesale with
organization-flavored props hardcoded in, this phase takes the same "add parameters"
approach section 1 took on the Rust side: `OrgDiplomaticRelations.tsx` accepts the
entity id, the two relationship-type constants, and the "list of all organizations"
query hook as props, rather than being a byte-for-byte copy with `PoliticalEntity`
substituted for `Organization`. This is a smaller, more mechanical generalization than
Phase 5/7's "not yet" decisions about generic components, because — same reasoning as
section 1.2 — the component's *logic* (pick a target, choose ally or rival, show two
lists) has no hidden entity-type-specific variation to discover; only the data source
and the two type strings differ, exactly the same shape of change the Rust-side
`symmetric.rs` extraction made.

## 5. Dashboard Integration

Same pattern as every prior phase: `DashboardPage.tsx`'s "Organizations" entry moves
from `COMING_SOON_CARDS` to a live `MetricCard`. Checked and removed the stale
Coming-Soon entry proactively per Phase 8/9's established habit.

## 6. Extensibility Notes for Future Phases

- If a future phase (per the brief: Ships, or a hypothetical "Factions" refinement)
  needs another org-hierarchy or symmetric-relationship consumer, both `hierarchy.rs`
  and `symmetric.rs` are now proven, reusable templates with real usage across 5 and 2
  call sites respectively.
- If a future phase needs a *cross-entity-type* symmetric relationship (e.g. an
  organization allied with a political entity), `symmetric.rs`'s generic helper already
  supports this at the data layer (it operates on bare entity ids and relationship-type
  strings) — only new relationship-type constants and UI wiring would be needed, no
  backend change.

## 7. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no membership rank/role tracking, no
cross-entity-type symmetric relationships wired up in this phase's UI (though the data
layer could support it), no financial/resource tracking for organizations. The data
model (`organization_details` with a single nullable `parent_organization_id`, plus
`affiliated_with`/`operates_at`/`org_allied_with`/`org_rival_of` relationships) is
shaped so none of these require a schema migration when they arrive.
