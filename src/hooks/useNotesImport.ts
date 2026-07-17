import { useMemo, useState } from "react";
import { useCanonEntries, useCreateCanonEntry } from "./useCanon";
import { useCharacters, useCreateCharacter } from "./useCharacters";
import { useCreateEvent, useEvents } from "./useEvents";
import { useCreateLocation, useLocations } from "./useLocations";
import { useCreateMilitaryUnit, useMilitaryUnits } from "./useMilitary";
import { useCreateOrganization, useOrganizations } from "./useOrganizations";
import { useCreatePoliticalEntity, usePoliticalEntities } from "./usePolitics";
import { useCreateReligion, useReligions } from "./useReligions";
import { useCreateSpecies, useSpeciesList } from "./useSpecies";
import { useCreateTechnology, useTechnologies } from "./useTechnologies";
import type { EntityTypeKey, ImportCandidate } from "../lib/notesParser";
import { ENTITY_TYPE_LABELS, parseNotes } from "../lib/notesParser";

export interface ReviewCandidate extends ImportCandidate {
  /** Whether this candidate matched an existing entity of the same
   * guessed type by exact case-insensitive name (FR3.1). */
  isDuplicate: boolean;
  /** Whether this candidate is currently selected for import. Defaults to
   * `!isDuplicate` (FR4.3) and can be toggled by the user either way
   * (FR3.3/FR4.3). */
  included: boolean;
}

/** Builds a `Set<lowercased name>` per entity type from the app's own
 * already-loaded list-page data (FR3.1) -- reuses the exact same `use*`
 * hooks CharacterList.tsx/LocationList.tsx/etc. already call, so no new
 * query is introduced solely for duplicate detection (design doc section
 * 2). */
interface ExistingNamesResult {
  namesByType: Record<EntityTypeKey, Set<string>>;
  /** True until every one of the 10 underlying list queries has resolved
   * at least once. Callers must not treat `namesByType` as authoritative
   * for duplicate-flagging while this is true -- every set starts out
   * empty before its query resolves, which would otherwise make every
   * candidate look non-duplicate for a brief window (a real bug if a
   * caller seeds its own state from that transient false-negative and
   * never reconciles once the real data arrives, see
   * `useImportCandidates`'s doc comment). */
  isLoading: boolean;
}

function useExistingNamesByType(): ExistingNamesResult {
  const { data: characters = [], isLoading: l1 } = useCharacters();
  const { data: locations = [], isLoading: l2 } = useLocations();
  const { data: technologies = [], isLoading: l3 } = useTechnologies();
  const { data: species = [], isLoading: l4 } = useSpeciesList();
  const { data: militaryUnits = [], isLoading: l5 } = useMilitaryUnits();
  const { data: politicalEntities = [], isLoading: l6 } = usePoliticalEntities();
  const { data: religions = [], isLoading: l7 } = useReligions();
  const { data: organizations = [], isLoading: l8 } = useOrganizations();
  const { data: canonEntries = [], isLoading: l9 } = useCanonEntries();
  const { data: events = [], isLoading: l10 } = useEvents();

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9 || l10;

  const namesByType = useMemo(() => {
    const toNameSet = (records: { name: string }[]) =>
      new Set(records.map((r) => r.name.toLowerCase()));

    return {
      character: toNameSet(characters),
      location: toNameSet(locations),
      technology: toNameSet(technologies),
      species: toNameSet(species),
      military: toNameSet(militaryUnits),
      politics: toNameSet(politicalEntities),
      religion: toNameSet(religions),
      organization: toNameSet(organizations),
      canon: toNameSet(canonEntries),
      event: toNameSet(events),
    };
  }, [characters, locations, technologies, species, militaryUnits, politicalEntities, religions, organizations, canonEntries, events]);

  return { namesByType, isLoading };
}

export interface ImportCandidatesResult {
  candidates: ReviewCandidate[];
  /** True until existing-entity data (needed for duplicate flagging, FR3.1)
   * has loaded at least once. Callers should not seed their own editable
   * review state from `candidates` while this is true (see
   * `NotesImportPage`'s seeding effect) -- every candidate's `isDuplicate`
   * would be a transient false-negative before the underlying list
   * queries resolve, and a caller that snapshots state exactly once (as a
   * review screen does, since further edits then live independently of
   * the memoized parse result) would otherwise be stuck with that
   * false-negative permanently, never reconciling once the real data
   * arrives. */
  isLoading: boolean;
}

/** Parses the given text (via the pure `parseNotes`, design doc section
 * 1) and flags likely duplicates against existing data (section 2). `text`
 * is local component state and `parseNotes` is a synchronous pure
 * function, so the parse itself is a plain `useMemo`, not a `useQuery` --
 * there is no backend to fetch from for parsing itself (design doc section
 * 4.1). Re-parses only when `text` changes, not on every keystroke --
 * callers are expected to only update `text` on an explicit "Analyze
 * Notes" action (FR1.2), not via onChange.
 *
 * `parseNotes` itself is invoked in its own `useMemo` keyed only on
 * `text`, keeping every candidate's `id` stable regardless of whether the
 * duplicate-lookup queries have resolved yet. The duplicate flag is
 * computed in a second memo layered on top, keyed on the existing-names
 * data too. `isLoading` is surfaced separately (rather than baking a
 * possibly-wrong `isDuplicate: false` into every candidate before the
 * underlying queries resolve) so a caller can wait for real data before
 * treating any candidate's duplicate flag as final. */
export function useImportCandidates(text: string): ImportCandidatesResult {
  const { namesByType, isLoading } = useExistingNamesByType();

  const parsed = useMemo(() => parseNotes(text), [text]);

  const candidates = useMemo(
    () =>
      parsed.map((candidate) => {
        const isDuplicate = namesByType[candidate.entityType].has(candidate.name.toLowerCase());
        return { ...candidate, isDuplicate, included: !isDuplicate };
      }),
    [parsed, namesByType],
  );

  return { candidates, isLoading };
}

export interface ImportResult {
  candidate: ReviewCandidate;
  status: "created" | "failed";
  /** Present when status is "created" -- the new entity's own id, used to
   * build a link to its detail page (FR5.3). */
  createdId?: string;
  /** Present when status is "failed" (FR5.2). */
  error?: string;
}

/** Today's date in the app's existing `YYYY-MM-DD` date-string convention
 * (matches every other entity type's date fields, e.g.
 * Event.start_date). Used as the synthesized placeholder start_date for
 * an imported Event candidate, since the parser has no reliable way to
 * extract a real date from prose in this phase's scope (design doc
 * section 4.3). */
function todayAsDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fans out a batch of included candidates to the existing 10
 * `useCreate*` mutations, one per entity type, dispatched by
 * `candidate.entityType` via a plain `switch` (design doc section 4.2).
 * A lookup-table dispatcher was considered and rejected: React's Rules of
 * Hooks require every mutation hook to be called unconditionally at the
 * top of this hook, so "dispatch by type" can only happen at the
 * *invocation* step, never in *which hooks exist* -- a switch over the
 * already-unconditionally-declared mutations is the only shape that
 * respects this constraint. */
export function useImportSelectedCandidates() {
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const createCharacter = useCreateCharacter();
  const createLocation = useCreateLocation();
  const createTechnology = useCreateTechnology();
  const createSpecies = useCreateSpecies();
  const createMilitaryUnit = useCreateMilitaryUnit();
  const createPoliticalEntity = useCreatePoliticalEntity();
  const createReligion = useCreateReligion();
  const createOrganization = useCreateOrganization();
  const createCanonEntry = useCreateCanonEntry();
  const createEvent = useCreateEvent();

  async function createOne(candidate: ReviewCandidate): Promise<ImportResult> {
    try {
      switch (candidate.entityType) {
        case "character": {
          const created = await createCharacter.mutateAsync({ name: candidate.name });
          return { candidate, status: "created", createdId: created.id };
        }
        case "location": {
          const created = await createLocation.mutateAsync({
            name: candidate.name,
            location_type: candidate.classification,
          });
          return { candidate, status: "created", createdId: created.id };
        }
        case "technology": {
          const created = await createTechnology.mutateAsync({
            name: candidate.name,
            category: candidate.classification,
          });
          return { candidate, status: "created", createdId: created.id };
        }
        case "species": {
          const created = await createSpecies.mutateAsync({
            name: candidate.name,
            classification: candidate.classification,
          });
          return { candidate, status: "created", createdId: created.id };
        }
        case "military": {
          const created = await createMilitaryUnit.mutateAsync({
            name: candidate.name,
            branch: candidate.classification,
          });
          return { candidate, status: "created", createdId: created.id };
        }
        case "politics": {
          const created = await createPoliticalEntity.mutateAsync({
            name: candidate.name,
            classification: candidate.classification,
          });
          return { candidate, status: "created", createdId: created.id };
        }
        case "religion": {
          const created = await createReligion.mutateAsync({
            name: candidate.name,
            classification: candidate.classification,
          });
          return { candidate, status: "created", createdId: created.id };
        }
        case "organization": {
          const created = await createOrganization.mutateAsync({
            name: candidate.name,
            classification: candidate.classification,
          });
          return { candidate, status: "created", createdId: created.id };
        }
        case "canon": {
          const created = await createCanonEntry.mutateAsync({ name: candidate.name });
          return { candidate, status: "created", createdId: created.id };
        }
        case "event": {
          // NewEvent uniquely requires start_date (design doc section
          // 4.3) -- the parser doesn't attempt date extraction in this
          // phase's scope, so a placeholder is synthesized and flagged
          // with the least-specific precision, signaling "this date is a
          // guess, not a real claim" rather than silently implying a
          // real date was detected.
          const created = await createEvent.mutateAsync({
            name: candidate.name,
            start_date: todayAsDateString(),
            date_precision: "century",
          });
          return { candidate, status: "created", createdId: created.id };
        }
      }
    } catch (err) {
      return {
        candidate,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /** Creates one entity per included candidate (FR5.1). A single
   * candidate's failure is reported without blocking the rest of the
   * batch (FR5.2) -- `Promise.allSettled` semantics give this for free
   * once each `createOne` call already catches its own error internally
   * and always resolves (never rejects) with an ImportResult, rather than
   * needing hand-rolled per-item try/catch bookkeeping at the call site. */
  async function importSelected(candidates: ReviewCandidate[]): Promise<ImportResult[]> {
    setIsImporting(true);
    try {
      const included = candidates.filter((c) => c.included);
      const settled = await Promise.allSettled(included.map((c) => createOne(c)));
      const finalResults = settled.map((outcome, i) =>
        outcome.status === "fulfilled"
          ? outcome.value
          : { candidate: included[i], status: "failed" as const, error: String(outcome.reason) },
      );
      setResults(finalResults);
      return finalResults;
    } finally {
      setIsImporting(false);
    }
  }

  function reset() {
    setResults(null);
  }

  return { importSelected, isImporting, results, reset };
}

export { ENTITY_TYPE_LABELS };
