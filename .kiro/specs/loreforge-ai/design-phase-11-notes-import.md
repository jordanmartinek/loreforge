# LoreForge AI — Phase 11: Notes Import — Design

## 1. The Heuristic Parser (`src/lib/notesParser.ts`)

### 1.1 Overall shape

```ts
export type EntityTypeKey =
  | "character" | "location" | "technology" | "species" | "military"
  | "politics" | "religion" | "organization" | "canon" | "event";

export type ConfidenceTier = "structured" | "keyword";

export interface ImportCandidate {
  id: string;            // stable within one parse run, for React keys / edits
  entityType: EntityTypeKey;
  name: string;
  confidence: ConfidenceTier;
  snippet: string;       // the source line/sentence the candidate came from
}

export function parseNotes(text: string): ImportCandidate[] { ... }
```

`parseNotes` is a pure function: `string in, ImportCandidate[] out`, no I/O, no
randomness (NFR2/NFR3/FR2.5). It is the one new piece of genuinely novel logic this
phase adds — everything downstream of it (review UI, creation) is wiring existing
per-type creation APIs to a new data source.

### 1.2 Pass 1: structured markers (high confidence)

A structured marker is a line matching one of a small set of explicit patterns that
name the entity type directly:

```
Character: Ada Voss
Character - Ada Voss
## Character: Ada Voss
[Location] New Geneva
Location: New Geneva
```

Implementation: one regex per entity type, each matching a line-level marker keyword
(case-insensitive) immediately followed by a separator (`:`, `-`, `—`) and then a name,
with an optional leading markdown heading/bracket. The marker keywords per type:

| entityType | marker keywords |
|---|---|
| character | `character` |
| location | `location`, `place` |
| technology | `technology`, `tech` |
| species | `species`, `race` |
| military | `military unit`, `unit`, `military` |
| politics | `political entity`, `faction`, `government` |
| religion | `religion`, `faith` |
| organization | `organization`, `org`, `guild` |
| canon | `canon`, `canon entry` |
| event | `event` |

This pass runs line-by-line over the whole text. A matched line produces one
`structured`-confidence candidate. This pass is checked first (and its matches are
excluded from Pass 2) since an explicit marker is unambiguous — there's no reason to
also run keyword-proximity heuristics on a line that already told us exactly what it
is.

### 1.3 Pass 2: keyword-proximity fallback (medium confidence)

For text with no structured markers (the common case — most worldbuilding notes are
prose, not a labeled outline), Pass 2 looks for **capitalized multi-word or
single-word proper nouns** (a simple regex: sequences of `Titlecase` words, 1-4 words
long, not at the start of a sentence unless the sentence has more than one capitalized
word — to avoid treating every sentence-initial word as a candidate) that appear within
a fixed window (same sentence, or within ~12 words) of a type-indicating keyword:

| entityType | proximity keywords |
|---|---|
| character | he, she, they, said, character, protagonist, was born, named |
| location | city, planet, station, building, located, region, world, colony |
| technology | technology, device, weapon, ship, drive, invented, powered by |
| species | species, race, alien, creature, sentient, breed |
| military | battalion, fleet, army, navy, unit, squadron, soldiers, commanded |
| politics | government, party, faction, alliance, ruled, elected, senate |
| religion | religion, faith, cult, worship, deity, temple, believers |
| organization | guild, corporation, syndicate, society, company, founded |
| canon | canon, established, official, retconned |
| event | battle, war, treaty, founding, occurred, happened, year |

Each proper noun / keyword pair produces one `keyword`-confidence candidate for that
entity type. If the same proper noun matches keyword lists for *multiple* entity types
in different parts of the text (e.g. "Ashenford" appears once near "guild" and once
near "city"), each match becomes its own candidate — deduplication (section 1.4) merges
same-name-same-type candidates, but deliberately does NOT try to pick a single "best"
type across different guessed types for the same name, since that's exactly the
judgment call the review screen (FR4.2) hands to the user instead of guessing wrong
silently.

Classification/category guessing (FR2.3) reuses the exact same proximity approach,
scoped to just that entity type's fixed vocabulary constants (`TECHNOLOGY_CATEGORIES`,
`SPECIES_CLASSIFICATIONS`, etc.) — e.g. if "weapon" appears near a Technology
candidate's name, guess `category: "weapons"`. This is attempted but not required;
an unmatched classification simply stays unset (the per-type `create` API already
defaults it to `"other"` server/mock-side, exactly as if a human had left it blank on
first creation).

### 1.4 Deduplication within one parse run

After both passes, candidates are grouped by `(entityType, name.toLowerCase())`. Within
a group, `structured` beats `keyword`; if multiple candidates remain tied at the same
confidence, the first-encountered snippet wins (FR2.6). This is a simple `Map` keyed by
the tuple, single pass, no fuzzy matching — an intentional scope limit: "Ada Voss" and
"ada voss" merge (case-insensitive), but "Ada Voss" and "Ada V." do not, since fuzzy
name-matching is a much harder, separately-scopable problem (and duplicate detection
against *existing* universe data, section 2, has the identical scope limit for the same
reason).

## 2. Duplicate Detection Against Existing Data

A candidate is flagged as a likely duplicate if `existingNamesByType[candidate.entityType]`
(a `Set<string>` of lowercased names, one per entity type, built once from each type's
already-loaded `use*List()` query data when the review screen mounts) contains
`candidate.name.toLowerCase()`. This reuses data the app has already fetched for its
list pages — no new query is introduced; `useCharacters()`, `useLocations()`, etc. are
called by the Notes Import page the same way `CharacterList.tsx` etc. already call them,
and their results are assembled into the lookup `Set`s.

Scope limit, matching section 1.4's: exact case-insensitive match only, no fuzzy
matching, no cross-type duplicate detection (a Character candidate named the same as an
existing Location is not flagged — different entity types are different namespaces by
design already, e.g. nothing stops "Meridian" from being both a Location and a
Political Entity in this app's existing data model).

## 3. Why confidence is a two-tier label, not a numeric score

Every prior phase that needed a business-rule signal (cycle detection, duplicate
symmetric edges, etc.) exposed it as a hard reject, not a score. Confidence here is
softer — it's advisory, shown to the user, not enforced — but the same "keep it
legible" principle applies: a numeric confidence score (e.g. "73% confidence") would
imply a precision this heuristic doesn't have and can't justify (there's no trained
model or statistical basis backing a percentage), and would invite the user to
over-trust an arbitrary-looking number. Two tiers — `structured` (the text told us
exactly what this is) and `keyword` (we're guessing from context) — map directly and
honestly onto the two detection passes in section 1, and are exactly the amount of
information the user needs to decide whether to trust a given candidate at a glance.

## 4. Review/Staging UI

```
src/lib/
  notesParser.ts          - parseNotes(text) -> ImportCandidate[] (section 1)
  notesParser.test.ts      - unit tests: structured markers per type, keyword-proximity
                             per type, dedup, determinism (NFR3), classification
                             guessing
src/hooks/
  useNotesImport.ts        - useImportCandidates(text) -- wraps parseNotes + duplicate-
                             flagging (section 2) as a pure computation (useMemo, not a
                             query -- there is nothing to fetch, per NFR2); +
                             useImportSelectedCandidates() mutation that fans out to the
                             existing 10 useCreateX hooks (FR5.1/FR5.2)
src/components/
  notes-import/
    NotesPasteForm.tsx       - the <textarea> + "Analyze Notes" button (FR1.1/FR1.2)
    CandidateReviewList.tsx    - grouped-by-type review list (FR4.1), each group with a
                                select-all/none toggle (FR4.5) and a list of
                                CandidateReviewRow
    CandidateReviewRow.tsx      - one candidate: editable name (Input), editable entity
                                type (Select, all 10 options), confidence Badge,
                                duplicate-flag Badge (FR4.4), snippet (muted text),
                                include/exclude checkbox
    ImportSummary.tsx           - post-import results: counts per type + links to each
                                created entity's detail page (FR5.3)
src/pages/
  NotesImportPage.tsx       - orchestrates: paste -> analyze -> review -> confirm ->
                             summary, as a simple local `useState` step machine
                             ("paste" | "review" | "summary"), mirroring the
                             two-pane-master-detail pattern's spirit (a single page
                             with local view-state) rather than multiple routes for
                             what is fundamentally one linear workflow
```

### 4.1 Why `useImportCandidates` is a `useMemo`, not a React Query hook

Every other `use*` data hook in this app (`useCharacters`, `useTechnologies`, etc.)
wraps a `useQuery` because it's fetching from a backend (real or mocked) that owns the
data. Parsing pasted text has no backend to query — the "data" is a local `useState`
string the user just typed, and `parseNotes` is a synchronous pure function. Wrapping it
in `useQuery` would add queryKey plumbing and cache-invalidation machinery for a
computation that's already as cheap as a `useMemo` and has no external source to ever
go stale against. This mirrors how `useGraphData` (Universe Graph, Phase 1) is *itself*
a `useMemo` over already-fetched query data rather than its own query — Notes Import's
`useImportCandidates` is the same shape, one level earlier (memoizing a pure function
over local component state instead of over other queries' results).

### 4.2 Bulk creation reuses the existing 10 mutations directly, not a new generic creator

`useImportSelectedCandidates` does not introduce a generic "createEntity(type, input)"
dispatcher. It holds all 10 `useCreate*` mutations (`useCreateCharacter`,
`useCreateLocation`, ... `useCreateEvent`) and switches on `candidate.entityType` to
call the matching one, per candidate, in a loop with `Promise.allSettled` (so FR5.2's
"one failure doesn't block the rest of the batch" falls out of `allSettled`'s semantics
for free, rather than needing hand-rolled per-item error isolation). A dispatcher
keyed by a runtime type string was considered and rejected: it would need a lookup table
mapping `EntityTypeKey` to a mutation hook, but React hooks cannot be called
conditionally or from inside a loop/table lookup (the Rules of Hooks) — every mutation
hook must be called unconditionally at the top of the component, so the "dispatch by
type" step can only happen in the *invocation*, not in *which hooks exist*. The
straightforward `switch` on `candidate.entityType` calling the already-unconditionally-
declared mutation is the only shape that respects this constraint, and is also just
readable code — ten `case` arms, one per existing creation hook, is not meaningfully
worse than a lookup table here.

### 4.3 Event's required `start_date` needs a synthesized default

Every other entity type's `New*` shape requires only `name`. `NewEvent` uniquely also
requires `start_date` (per Phase 2's design). Since the parser has no reliable way to
extract a date from prose text in this phase's scope (date extraction is its own
non-trivial heuristic problem, not attempted here), an Event candidate that's included
in the import is created with `start_date` defaulted to today's date at import time,
and `date_precision: "century"` (the least-specific precision option, signaling "this
date is a placeholder, not a real claim about when this happened") — the user is
expected to correct it afterward on the event's own detail page, exactly as they would
for any other field this phase doesn't attempt to guess (biography, description,
tenets, etc. — see requirements doc's Explicitly Out of Scope). This is called out
explicitly in `ImportSummary.tsx`'s per-Event-candidate result line ("date not
detected — defaulted, please review") so the user isn't surprised by an unexplained
date on the new Event.

## 5. Dashboard Card

Unlike every Phase 1-10 `MetricCard`, "Notes Import" has no persistent count to show —
there's no `notes_imported_total` in `DashboardMetrics`, because imported *text* is
never stored (only the entities it produces are, and those already show up under their
own type's card). Rather than inventing a fake metric or leaving the card as a
`comingSoon` placeholder (it isn't coming soon — it's done), `MetricCard` gains an
optional `description` prop as an alternative to `metrics`:

```tsx
<MetricCard
  title="Import Notes"
  icon="✎"
  to="/notes-import"
  description="Paste notes to detect new story elements"
/>
```

When `description` is provided (and `metrics` is not), the card renders the description
text in place of the metrics grid — a small, additive change to `MetricCard.tsx`
(one new prop, one new conditional render branch) rather than a parallel card
component, since every other visual aspect (border, hover state, icon, click-through)
is identical to a metric card; only the body content differs.

## 6. What This Design Deliberately Does Not Do

Per requirements.md Out of Scope: no file upload, no LLM/AI-assisted extraction, no
automatic relationship detection between imported entities, no full-field editing from
the review screen, no merge-into-existing-entity flow. The parser is a pure, offline,
deterministic function operating only on the pasted text and already-loaded existing
entity names (for duplicate flagging) — it introduces no new backend surface, no new
network dependency, and no new relationship types.
