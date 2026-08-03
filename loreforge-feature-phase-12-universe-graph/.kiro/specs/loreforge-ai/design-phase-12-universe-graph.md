# LoreForge AI — Phase 12: Universe Graph Expansion — Design

## 1. Overview

This phase touches exactly three existing files (`useGraphData.ts`, `UniverseGraph.tsx`,
`GraphFilters.tsx`) plus one new shared module (`lib/entityTypes.ts`). No new Tauri
commands, no schema change — every entity type's data was already reachable via its own
`use*` list-query hook (`useCharacters`, `useLocations`, `useTechnologies`, ...,
`useEvents`); this phase's job is purely "read from all ten instead of one" plus the
rendering change to draw persistent labels.

## 2. Shared Entity-Type Registry (`lib/entityTypes.ts`)

Phase 11 (Notes Import) had already built exactly the (key, label) registry this phase
needs — `EntityTypeKey`, `ENTITY_TYPE_KEYS`, `ENTITY_TYPE_LABELS` — as a
`notesParser.ts`-local concept. Rather than duplicating it or having the graph reach
into a notes-import-specific file, it's hoisted into its own module,
`lib/entityTypes.ts`, that both features import from. `notesParser.ts` re-exports the
same three names unchanged (`export type { EntityTypeKey } from "./entityTypes"` etc.),
so nothing that already imports them from `"../../lib/notesParser"` (every notes-import
component/hook/test) needed to change.

This phase adds one new export to that module: `ENTITY_TYPE_COLORS`, a fixed
`Record<EntityTypeKey, string>` categorical palette (one hex color per type), used by
both the graph's node coloring and the filter bar's legend swatches — a single source of
truth, so a node's color and its filter toggle's swatch can never drift out of sync.

### 2.1 Why a fixed palette, not `nodeAutoColorBy`

`force-graph` offers a built-in `nodeAutoColorBy` that assigns colors automatically by
grouping on any accessor. This phase uses an explicit fixed map instead, for two
reasons: (a) the filter bar's legend swatches need to know each type's color *before*
any graph data exists (e.g. to render a swatch next to a toggle when the universe is
still empty), which an auto-assigned palette can't provide since it only exists once
data is present; (b) explicit colors are chosen once and stay stable across every
session/dataset, whereas auto-assigned colors can reshuffle as new distinct values are
encountered, which would make "military units are red" a claim that's only true for as
long as no new grouping value appears — undesirable for a legend a user is meant to
learn and rely on.

## 3. `useGraphData.ts`: Multi-Type Node Selector

### 3.1 Reusing each type's own list hook, not a new combined query

```ts
export function useGraphData(entityTypeFilter: Set<EntityTypeKey>): GraphData {
  const { data: characters = [], isLoading: l1 } = useCharacters();
  const { data: locations = [], isLoading: l2 } = useLocations();
  // ...one pair per entity type, mirroring useNotesImport.ts's
  // useExistingNamesByType from Phase 11, which established this exact
  // pattern one phase earlier for the same reason: every list page
  // already calls these hooks, and TanStack Query's cache means calling
  // the same hook again elsewhere is a cache hit, not a duplicate
  // network/IPC round-trip.
  ...
}
```

Each entity's row is mapped into a common `GraphNode` shape:

```ts
export interface GraphNode {
  id: string;
  name: string;
  entityType: EntityTypeKey;
  subtitle: string;   // role | location_type | category | classification | branch | ...
  degree: number;
}
```

`subtitle` is deliberately a single generic string field, not ten different
type-specific fields threaded through the rendering layer — each entity type's own
"kind" column (`role` for Character, `location_type` for Location, `category` for
Technology, `classification` for Species/Politics/Religion/Organization, `branch` for
Military, `status` for Canon, `significance` for Event) is picked once, per type, inside
`useGraphData`'s own mapping step, so `UniverseGraph.tsx`'s tooltip code doesn't need a
type-`switch` of its own — it just reads `node.subtitle` uniformly (FR1.3).

### 3.2 Degree computed after all types are merged, not per-type

Because relationships can (starting Phase 8) connect two *different* entity types (e.g.
Politics' `controls`: political entity → location), degree/centrality can't be computed
independently within each type's own mapper — a location's degree needs to count
`controls` edges from political entities, not just `located_at` edges from characters.
So node-building happens in two steps: first, every type's raw entities are mapped into
`GraphNode`s with `degree: 0` (grouped by type, so filtering can select subsets of the
already-built list without re-mapping); second, a single pass over
`useAllRelationships()`'s full result builds one global `id -> degree` map and merges it
onto whichever nodes survive the active `entityTypeFilter` (FR3.2). This mirrors Phase
1's original single-type degree computation shape, just moved after the merge point
instead of being the only computation there was.

### 3.3 Filtering is a client-side `.filter()`, matching Phase 1's original intent

`entityTypeFilter: Set<EntityTypeKey>` is applied by filtering the already-built,
already-fetched node list — the exact mechanism Phase 1 design.md section 5 described
("a static list of known types... so adding 'location', 'technology', etc. later is a
one-line data change, not a redesign"), just now iterating over 10 entries instead of 1.
No new query parameters, no server/mock-backend involvement — every type's data was
already loaded (the graph shows "everything, all at once" by default per FR2.1, so all
10 queries fire regardless of the current filter selection; toggling a filter never
triggers a new fetch, only a recomputation of which already-loaded nodes are included).

### 3.4 `hasAnyEntities`: disambiguating "empty universe" from "filtered to nothing"

A real bug surfaced while writing this phase's tests: the original plan was to keep
Phase 1's `nodes.length === 0` check as the sole "show empty state" condition. But with
10 filterable types instead of 1, toggling off the *only* type that currently has data
makes `nodes.length` hit zero **because of the filter**, not because the universe is
actually empty — and Phase 1's empty state doesn't render the filter bar at all (there's
nothing to filter yet when the universe is genuinely empty), so hitting that branch via
a filter toggle would hide the very control needed to undo it, stranding the user.

`GraphData` therefore exposes a second, independent boolean, `hasAnyEntities` — true if
*any* entity of *any* type exists, computed before the active filter is applied.
`UniverseGraph.tsx` branches on `hasAnyEntities` (not `nodes.length`) to decide whether
to render the original "no nodes yet" full-empty state; `nodes.length === 0` is instead
used *inside* the normal (filter-bar-visible) render path to show a lighter, in-context
"No entities match the active filters" message that leaves every control -- including
the filter bar itself -- reachable. This is exercised directly by a regression test
(`UniverseGraph.test.tsx`: "keeps the filter bar visible even when the active filters
hide every entity").

## 4. `UniverseGraph.tsx`: Persistent Labels

### 4.1 `nodeCanvasObjectMode: "after"`, not `"replace"`

`react-force-graph-2d` exposes `nodeCanvasObject` + `nodeCanvasObjectMode` for custom
per-node canvas drawing. Reading `force-graph`'s own `canvas-force-graph.js`
(`paintNodes()`): mode `"replace"` means the library skips its own circle-drawing
entirely and expects the custom callback to draw everything (color, shape, the works);
mode `"after"` means the library draws its normal circle first (respecting `nodeColor`/
`nodeVal` exactly as before), then calls the custom callback on top. This phase uses
`"after"`, so the existing circle-drawing/coloring/sizing logic from Phase 1 is left
completely untouched, and the custom callback's only job is drawing the label text
beneath the circle — the minimal-diff choice, and the only one that doesn't require
re-implementing color/size/degree-based radius logic a second time inside the label
callback.

### 4.2 Label sizing tracks `globalScale`, matching the library's own zoom-independent-text convention

```ts
const fontSize = Math.max(3, 11 / globalScale);
```

`globalScale` grows as the user zooms in. Dividing by it keeps the label's *screen* size
roughly constant rather than scaling 1:1 with node/graph zoom (a label that got larger
every time you zoomed in would quickly overwhelm the canvas) — this is the standard
pattern shown in `react-force-graph`'s own label-rendering examples, not a novel
approach invented for this phase.

### 4.3 A background rectangle behind each label

Each label is drawn with a semi-transparent dark rectangle (`rgba(10, 10, 15, 0.75)`)
behind it, sized to the measured text width via `ctx.measureText`. With up to 10 node
colors now on screen simultaneously (vs. Phase 1's single role-based palette), unbacked
text risks becoming illegible over a busy link/node backdrop; the background box keeps
every label readable regardless of what's rendered underneath it, without introducing a
second DOM-based overlay layer (which canvas-based graphs specifically avoid for
performance at scale, per Phase 1 design.md section 1's rationale for choosing canvas
rendering in the first place).

### 4.4 Dimmed labels follow the existing highlight/dim state

Clicking a node (Phase 1 FR5.3) already computes a 1-hop neighborhood and dims
non-neighbor nodes' fill/link colors. The label-drawing callback checks the same
`highlighted` state and switches to a dimmed text color (`#55555f` vs. the normal
`#eceef3`) for non-neighbor labels, so the existing highlight interaction extends
naturally to labels instead of leaving every label at full brightness regardless of
selection (which would undercut the whole point of the dim-on-select interaction).

## 5. `GraphFilters.tsx`: 10-Type Filter Bar / Legend

Rewritten to iterate `ENTITY_TYPE_KEYS` (10 entries) instead of a single hardcoded
`{ type: "character", label: "Characters" }` array. Each toggle renders a small colored
`<span>` swatch (`ENTITY_TYPE_COLORS[type]`, dimmed via `opacity` when inactive) next to
its label, so the filter bar is simultaneously the interactive filter control *and* the
graph's color legend (FR2.3) — no separate legend UI element to keep visually
synchronized with it.

## 6. What Changed vs. What Didn't

**Changed:** `useGraphData.ts` (multi-type sourcing, subtitle mapping, cross-type degree,
`hasAnyEntities`), `UniverseGraph.tsx` (default-all-types-active state, persistent
label drawing, `hasAnyEntities`-based empty state, in-filter "nothing matches" message),
`GraphFilters.tsx` (10-entry iteration + color swatches), new `lib/entityTypes.ts`
(hoisted registry + new `ENTITY_TYPE_COLORS`), `notesParser.ts` (re-exports instead of
owning the registry).

**Unchanged:** every entity type's own CRUD hooks/pages/detail views; the
`relationships` data model; the force-directed physics/layout engine; the
click-to-highlight-neighborhood interaction's underlying logic (only its label-drawing
extension is new); `crates/` and `src-tauri/` (zero backend changes, second
frontend-only phase after Phase 11).

## 7. Extensibility Notes for Future Phases

- An 11th entity type (e.g. a future Mystery Tracker's `mystery` entity) needs: one more
  entry in `ENTITY_TYPE_KEYS`/`ENTITY_TYPE_LABELS`/`ENTITY_TYPE_COLORS`
  (`lib/entityTypes.ts`), one more `use*` hook pair in `useGraphData.ts`'s
  `allNodesByType` builder, and nothing else — `GraphFilters.tsx` and
  `UniverseGraph.tsx`'s rendering logic are both driven by `ENTITY_TYPE_KEYS` and need no
  changes, fulfilling the "one-line data change" promise Phase 1 design.md section 5
  made and this phase already had to exercise for the first 9 types at once.
- The future Story Analytics / Universe Health Dashboard phases could reuse
  `useGraphData`'s cross-type degree computation directly (e.g. "which entities have the
  highest connectivity across the whole universe, not just among characters") without
  any change to this phase's code.
