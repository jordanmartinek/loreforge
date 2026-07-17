# LoreForge AI — Phase 10: Organizations — Requirements

## Context

The original brief lists Organizations among the entity types a mature worldbuilding
tool needs: guilds, corporations, syndicates, secret societies, and other structured
groups that don't fit Politics' government/party/faction framing or Military's
chain-of-command framing. Phase 10 implements it as a new `organization` entity type.

### What's structurally new in this phase: nothing on its own, but a second data point for two different generalizations

Organizations, like Politics, needs a parent-organization hierarchy (a regional guild
chapter reports to a national guild) — the same strict-tree shape Locations/Species/
Military/Religions already have, making this the **fifth** consumer of the
`hierarchy.rs` helper extracted in Phase 9. Nothing new to design there; `organizations.rs`
consumes `hierarchy::would_create_cycle` from day one, the same way `religions.rs` did.

The genuinely new question this phase raises: Organizations also needs org-to-org
alliance/rivalry relationships — the same symmetric shape Phase 8 introduced for
`allied_with`/`rival_of` between political entities. This is the **second** consumer of
that symmetric-relationship pattern, and unlike `hierarchy.rs` (which waited for a
*fourth* data point before extracting, because three independent implementations were
needed to be confident there was no variation), this phase's design doc argues that
*two* is enough for the symmetric-edge case, because the shape of Phase 8's
`create_symmetric_edge`/`list_allies`/`list_rivals` was already written once to be
about as generic as it could be for a single relationship-type family (it takes the
relationship type as a parameter, not a hardcoded string) — the only entity-specific
thing about it was which table it fetched full records from to resolve "the other side."
See design-phase-10-organizations.md section 1 for why this phase extracts a shared
`symmetric.rs` after only two data points, in contrast to `hierarchy.rs`'s four-point
threshold, and why that's not a contradiction — it's calibrating the "how many examples
before generalizing" threshold to how much genuine variation each specific piece of
logic actually has, not applying a fixed rule of "always wait for N."

## Phase 10 Scope

1. **Generic symmetric-edge helper (refactor)** — extract a `symmetric.rs` module with
   `create_symmetric_edge` and `list_symmetric_links`, parameterized by (a) the two
   relationship type strings that are mutually exclusive with each other, and (b) a
   caller-supplied "resolve a full record for this id" function (since Politics
   resolves `PoliticalEntity` records and Organizations will resolve `Organization`
   records — different tables, same shape of lookup). Migrate `politics.rs` to consume
   it, matching Phase 9's precedent for `hierarchy.rs`: no observable behavior change,
   proven by Politics' existing test suite passing unmodified.
2. **Organization entity type** — a new `organization_details` table: `classification`
   (fixed vocabulary: guild | corporation | syndicate | secret_society |
   trade_association | criminal_enterprise | other), `charter` (free-text notes on
   founding purpose/bylaws/culture), and a nullable `parent_organization_id`
   (self-referential, for chapters/subsidiaries — e.g. a regional chapter under a
   national guild), using `hierarchy.rs` for cycle prevention and reparent-on-delete.
3. **`affiliated_with` relationship** — a character can be linked to the organization
   they're affiliated with (source = character, target = organization), reusing the
   `relationships` table. Structurally identical to every prior phase's
   character-to-entity directional relationship (Phase 6's `member_of`, Phase 7's
   `serves_in`, Phase 8's `leads`, Phase 9's `follows`).
4. **`operates_at` relationship** — an organization can be linked to the location(s) it
   operates out of (source = organization, target = location). Structurally identical
   to Phase 6's `native_to`/Phase 7's `stationed_at`/Phase 8's `controls`/Phase 9's
   `holy_site`.
5. **`org_allied_with` / `org_rival_of` relationships** — symmetric relationships
   between two organizations, consuming the new shared `symmetric.rs` helper (distinct
   relationship-type strings from Politics' `allied_with`/`rival_of`, since an
   organization and a political entity being "allied" are conceptually different facts
   even though the underlying validation logic is identical — see design doc section
   1.2 for why the relationship-type strings stay separate per entity type rather than
   being shared globally).
6. **Organizations UI** — a flat, filterable list (by classification), not a tree — same
   design decision as every prior tree-shaped-but-flat-navigation phase. An
   organization's detail view shows its parent organization (if any), its direct
   subsidiaries (read-only list), its affiliated members, its locations of operation,
   and an "Alliances & Rivalries" section (reusing Phase 8's `DiplomaticRelations.tsx`
   shape, generalized to take its relationship-type pair and target entity type as
   props rather than being hardcoded to Politics).
7. **Dashboard integration** — the existing "Organizations" Coming Soon card becomes
   live, showing total organizations and a breakdown by classification. Per Phase 8/9's
   established habit, proactively check `COMING_SOON_CARDS` for a stale entry and
   remove it in the same change.

### Explicitly Out of Scope for Phase 10

Membership rank/role tracking (e.g. "Guildmaster" vs. "Journeyman") within a single
organization — an `affiliated_with` link is a simple current-state membership link, not
a role or rank, mirroring every prior phase's identical non-scoping of this exact
concern (Phase 7's military rank, Phase 8's elections, Phase 9's clergy hierarchy — this
is now a running pattern, not a one-off decision, and this phase doesn't reopen it).
Cross-entity-type symmetric relationships (e.g. an organization allied with a political
entity, not just with another organization) — `symmetric.rs`'s generic helper could
technically support this since it operates on entity ids and relationship-type strings
without caring what entity type either side is, but this phase's UI and relationship-type
constants only wire up organization-to-organization pairs; a future phase could extend
this without further backend changes if the brief calls for it. Franchise/business
financials or resource tracking — out of scope, not part of the original brief's
description of this entity type.

## Functional Requirements

### FR1 — Generic Symmetric-Edge Helper (Refactor)
- FR1.1: The system SHALL provide `create_symmetric_edge` and `list_symmetric_links` in
  `symmetric.rs`, parameterized by the pair of mutually-exclusive relationship-type
  strings and a caller-supplied full-record resolver function.
- FR1.2: `politics.rs` SHALL be refactored to call the shared helper instead of its own
  copy, with no change to its public function signatures or observable behavior.
- FR1.3: All existing Politics unit tests SHALL continue to pass unmodified after the
  refactor (the correctness proof for FR1.2, mirroring Phase 9's NFR3 for
  `hierarchy.rs`).

### FR2 — Organization Entity & Hierarchy Data Model
- FR2.1: The system SHALL store organizations as `entities` rows with
  `entity_type = 'organization'`, plus an `organization_details` row per organization.
- FR2.2: Each organization SHALL support: `classification` (fixed vocabulary, see Phase
  10 Scope item 2), `charter` (free-text description), and an optional
  `parent_organization_id`.
- FR2.3: An organization SHALL NOT be able to become its own ancestor (identical
  cycle-prevention contract to Phase 4/6/7/9, implemented via the shared `hierarchy.rs`
  helper).
- FR2.4: Organizations SHALL support soft delete and full revision history, identical
  to every prior entity type.

### FR3 — Subsidiary Queries & Deletion
- FR3.1: The system SHALL be able to list the direct subsidiaries of a given
  organization (or of the root, i.e. organizations with `parent_organization_id IS
  NULL`).
- FR3.2: An organization's detail view SHALL show its parent organization (if any) by
  name, and its direct subsidiaries (read-only list).
- FR3.3: Deleting an organization SHALL reparent its direct subsidiaries to the deleted
  organization's own parent (or to root if it had none) — identical reparent-on-delete
  contract to Phase 4/6/7/9.
- FR3.4: Deleting an organization SHALL cascade soft-delete any `relationships` touching
  it (`affiliated_with`, `operates_at`, `org_allied_with`, `org_rival_of`), without
  affecting the characters/locations/other organizations on the other end.
- FR3.5: Reparenting SHALL be rejected if the new parent is the organization itself or
  one of its own descendants.

### FR4 — `affiliated_with` and `operates_at` Relationships
- FR4.1: Users SHALL be able to link a character to an organization via
  `affiliated_with` (source = character, target = organization).
- FR4.2: Users SHALL be able to link an organization to a location via `operates_at`
  (source = organization, target = location).
- FR4.3: An organization's detail view SHALL show its affiliated members and its
  locations of operation, and allow adding/removing both kinds of links.
- FR4.4: A character's detail view SHALL show its affiliated organization (if any); a
  location's detail view SHALL show the organizations that operate there — symmetric
  visibility, consistent with every prior phase's reciprocal-link pattern.

### FR5 — `org_allied_with` / `org_rival_of` Symmetric Relationships
- FR5.1: Users SHALL be able to mark two organizations as allied (`org_allied_with`) or
  rivals (`org_rival_of`), using the shared `symmetric.rs` helper (FR1.1).
- FR5.2: Creating an `org_allied_with` or `org_rival_of` edge SHALL be rejected if an
  edge of that same type already exists between the same pair, in either direction.
- FR5.3: Creating an `org_allied_with` edge SHALL be rejected if an `org_rival_of` edge
  already exists between the same pair (and vice versa).
- FR5.4: An organization's detail view SHALL show its allies and rivals as two separate
  lists, resolved correctly regardless of which side initiated the link.
- FR5.5: An organization SHALL NOT be able to be marked as its own ally or rival.

### FR6 — Organizations UI
- FR6.1: The primary Organizations view SHALL be a filterable, virtualized list (by
  classification and search), consistent with every prior flat-list entity type.
- FR6.2: Users SHALL be able to create, edit, and delete organizations, with autosave
  (no explicit save action) on every field.
- FR6.3: The organization detail view SHALL show and allow editing of: classification,
  charter, parent organization (a "Set parent organization…" picker, subject to FR2.3's
  cycle-prevention), subsidiaries (FR3.2, read-only), affiliated members (FR4.3),
  locations of operation (FR4.3), and an Alliances & Rivalries section (FR5.4).
- FR6.4: The Organizations view SHALL update immediately when an organization or any of
  its relationships is created, edited, or deleted.

### FR7 — Dashboard & Navigation Integration
- FR7.1: The Dashboard's "Organizations" card SHALL become live, showing: total
  organizations and a count of distinct classifications in use.
- FR7.2: The sidebar SHALL gain an "Organizations" navigation entry.
- FR7.3: Dashboard Organizations metrics SHALL update reactively on organization
  create/delete.

## Non-Functional Requirements

- NFR1 (Consistency with Phases 1-9): No changes to `entities`, `relationships`, or
  `revisions` table schemas. Only a new `organization_details` table (with its
  self-referential FK), a new `symmetric.rs` module, and new Rust/TS modules for
  Organizations.
- NFR2 (Reliability): Reparenting and symmetric-edge creation SHALL both be
  transactional, validated before committing — identical contract to every prior
  phase's business-rule checks.
- NFR3 (Refactor safety): The `symmetric.rs` extraction (FR1) SHALL be validated purely
  by Politics' existing test suite passing unmodified — no new tests are needed to prove
  the refactor itself is behavior-preserving.

## Acceptance Criteria (Phase 10 "Done")

1. User can create an organization (e.g. "Ashenford Trading Guild") with a
   classification and charter, persisting with zero explicit save action.
2. User can create a second organization ("Ashenford Trading Guild, Riverside Chapter")
   and set its parent organization; the chapter's detail view shows the guild as its
   parent, and the guild's detail view shows the chapter as a subsidiary.
3. Attempting to set the guild's parent to its own chapter (its own descendant) is
   rejected.
4. Deleting the guild (which has the chapter as a subsidiary) leaves the chapter in the
   list, now with no parent (reparented to root).
5. Linking a character to an organization via `affiliated_with` shows that character on
   the organization's detail view, and shows the organization on the character's own
   detail view.
6. Linking an organization to a location via `operates_at` shows that location on the
   organization's detail view, and shows the organization on the location's own detail
   view.
7. Marking two organizations as `org_allied_with` shows each as the other's ally,
   symmetrically, regardless of which one initiated the link.
8. Attempting to mark the same pair as allied a second time, or as rivals while already
   allied (or vice versa), is rejected.
9. Deleting an organization removes it from the list and the Dashboard's count; its
   `affiliated_with`, `operates_at`, `org_allied_with`, and `org_rival_of` relationships
   are cleanly removed without affecting the other side.
10. Dashboard's Organizations card shows live, accurate total and classification-
    breakdown counts.
11. After the `symmetric.rs` extraction, every pre-existing Politics test still passes
    unmodified, proving the refactor changed no observable behavior.
12. `cargo test` (loreforge-core), `tsc -b`, `vite build`, and the frontend test suite
    all pass with no errors (same verification bar as Phases 1-9).
