# LoreForge AI — Phase 12: Universe Graph Expansion — Requirements

## Context

The user asked, directly: "add the first name for the character in the universe graph
chart, or some way that I can see the characters, locations, and everything else plotted
on the graph at a glance." Looking at the actual Phase 1 implementation, two gaps map to
that request:

1. **No persistent labels.** `UniverseGraph.tsx` only showed a node's name in a hover
   tooltip (`onNodeHover`). With the node dimmed/unlabeled by default, there was no way
   to identify *any* node — character or otherwise — without hovering it one at a time.
2. **Characters only.** Despite nine more entity types having shipped since Phase 1
   (Locations, Technology, Species, Military, Politics, Religions, Organizations, plus
   Events and Canon from Phases 2-3), `useGraphData.ts` still only ever read
   `useCharacters()`. Locations, technologies, and everything else were never nodes on
   the graph at all, regardless of how many relationships referenced them. This is
   exactly the "characters, locations, and everything else" the user is asking to see.

Phase 1's own design.md (section 5) explicitly called out that the filter bar was
"structured to add more types later without redesign... a one-line data change, not a
redesign" — this phase is that promised one-line-per-type change, just exercised for the
first time, now that nine more entity types actually exist to plot.

## Phase 12 Scope

1. **Persistent name labels** — every node's name renders directly on the graph as a
   small text label beneath it, always visible (not gated behind hover), so the whole
   graph is legible at a glance without interacting with it node-by-node.
2. **All 10 entity types as graph nodes** — Characters, Locations, Technologies,
   Species, Military Units, Political Entities, Religions, Organizations, Canon
   Entries, and Events all become nodes, sourced from each type's own already-existing
   `use*` list-query hook (no new backend query).
3. **Color-coded by type** — each entity type gets its own fixed node color, so type is
   visually distinguishable at a glance even before reading a label, and the existing
   filter bar doubles as a color legend.
4. **Filter bar extended to all 10 types** — the Phase 1 filter bar (previously a single
   "Characters" toggle) gains one toggle per entity type, all active by default (so the
   default view is "everything, all at once" per the user's literal request), each
   showing that type's legend color swatch.
5. **Cross-type relationships plotted** — relationships between two different entity
   types (e.g. Politics' `controls` linking a political entity to a location, or
   Military's `stationed_at` linking a unit to a location) render as edges exactly like
   character-to-character relationships always have; degree/centrality sizing accounts
   for all of them, not just character-to-character links.

### Explicitly Out of Scope for Phase 12

Changing the underlying force-directed layout algorithm or switching to a different
graph-rendering library; a dedicated "focus mode" that isolates one entity type's
subgraph (the filter bar already lets a user narrow to one type, which covers this);
per-type icons/shapes beyond color (a future refinement, not part of this ask);
label collision/decluttering logic for very dense graphs (acceptable for this phase's
expected data volumes, consistent with Phase 1 NFR2's "not tested at that scale yet"
posture); any change to how relationships are created/edited (this phase only changes
what's *read* onto the graph, not the relationship data model itself).

## Functional Requirements

### FR1 — Persistent Labels & Multi-Type Nodes
- FR1.1: The Universe Graph SHALL render a node for every entity of all 10 entity types
  (Character, Location, Technology, Species, Military Unit, Political Entity, Religion,
  Organization, Canon Entry, Event), not just Character.
- FR1.2: Every visible node SHALL display its name as a persistent on-canvas label,
  visible without hovering or clicking.
- FR1.3: Hovering a node SHALL continue to show a summary tooltip (name, entity type,
  and a short type-appropriate subtitle — e.g. a character's role, a location's
  location_type), extending Phase 1 FR5.2's contract to the other 9 types.

### FR2 — Filtering & Legend
- FR2.1: The entity-type filter bar SHALL show one toggle per entity type (10 total),
  all active by default.
- FR2.2: Toggling a type off SHALL immediately remove that type's nodes (and any edges
  touching only excluded nodes) from the rendered graph, with no manual refresh.
- FR2.3: Each filter toggle SHALL show that entity type's fixed legend color as a
  swatch, so the filter bar also documents the graph's color coding.
- FR2.4: If the active filter selection excludes every entity that currently exists, the
  filter bar SHALL remain visible and interactive (so the user can turn a type back on)
  — this must be visually distinct from the "the universe has no entities of any type
  yet" empty state, which is the only case where the filter bar itself is hidden.

### FR3 — Cross-Type Relationships
- FR3.1: A relationship whose source and target are different entity types SHALL render
  as an edge on the graph exactly like same-type relationships already do, provided both
  endpoints' types are currently active in the filter.
- FR3.2: Node size (degree-based, per Phase 1 design.md section 5) SHALL count edges to
  and from entities of any type, not just other characters.

### FR4 — Reactivity
- FR4.1: The graph SHALL continue to update immediately (no manual refresh) when any
  entity of any of the 10 types, or any relationship, is created, edited, or deleted —
  extending Phase 1 FR5.5's contract to the other 9 types.

## Non-Functional Requirements

- NFR1 (Consistency with Phase 1): No changes to `entities`, `relationships`, or
  `revisions` schemas, and no new Tauri commands — this phase is a frontend read-side
  change only (new selector logic + rendering), reusing every entity type's existing
  list-query hook.
- NFR2 (Performance posture): Persistent labels are drawn via the existing canvas
  renderer's custom-paint hook (no new DOM elements per node), consistent with Phase 1
  NFR1's "instant" interaction requirement and the canvas-based rendering choice made
  for scalability in Phase 1 design.md section 1.

## Acceptance Criteria (Phase 12 "Done")

1. Creating a character, then opening the Universe Graph, shows that character's name
   as a visible label on its node without needing to hover it.
2. Creating a location, a technology, and any other non-character entity all appear as
   labeled nodes on the graph, color-coded distinctly from characters and from each
   other.
3. The filter bar shows a toggle (with a color swatch) for all 10 entity types, all
   active by default; toggling one off immediately removes its nodes from view.
4. Toggling off the only entity type that currently has data leaves the filter bar
   visible (so it can be toggled back on) rather than reverting to the "no entities at
   all" empty state.
5. A relationship linking two different entity types (e.g. a political entity
   `controls` a location) renders as an edge connecting both nodes.
6. `cargo check`/`cargo test` (unmodified — no backend changes this phase), `tsc -b`,
   `vite build`, and the full frontend test suite all pass with no errors (same
   verification bar as every prior phase).
