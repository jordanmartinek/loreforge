// A tiny in-memory mock of the Tauri backend, used ONLY when the app is
// running outside of a real Tauri window (e.g. `npm run dev` in a plain
// browser for UI iteration). It mirrors the exact behavior of
// crates/loreforge-core so the UI layer is developed/tested against the
// same contract it will use in the real native app.
//
// This is intentionally kept separate from lib/tauri.ts: production/native
// builds never import this file's logic path (see lib/api.ts).

import type {
  CanonEntry,
  CanonEntryPatch,
  CanonFilter,
  Character,
  CharacterFilter,
  CharacterPatch,
  DashboardMetrics,
  Event,
  EventFilter,
  EventPatch,
  Location,
  LocationFilter,
  LocationPatch,
  MilitaryUnit,
  MilitaryUnitFilter,
  MilitaryUnitPatch,
  NewCanonEntry,
  NewCharacter,
  NewEvent,
  NewLocation,
  NewMilitaryUnit,
  NewOrganization,
  NewPoliticalEntity,
  NewRelationship,
  NewReligion,
  NewSpecies,
  NewTechnology,
  Organization,
  OrganizationFilter,
  OrganizationPatch,
  ProjectInfo,
  PoliticalEntity,
  PoliticalEntityFilter,
  PoliticalEntityPatch,
  Relationship,
  RelationshipPatch,
  Religion,
  ReligionFilter,
  ReligionPatch,
  RevisionEntry,
  Species,
  SpeciesFilter,
  SpeciesPatch,
  Technology,
  TechnologyFilter,
  TechnologyPatch,
} from "./types";
import { ALLIED_WITH, ORG_ALLIED_WITH, ORG_RIVAL_OF, REQUIRES, RIVAL_OF } from "./types";

function uuid(): string {
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now(): string {
  return new Date().toISOString();
}

// Each mock "project" gets its own localStorage key for its dataset, so
// switching projects in dev/browser mode actually swaps data instead of
// sharing one global dataset -- mirrors the real backend giving each
// project its own SQLite file.
const DB_STORAGE_KEY_PREFIX = "loreforge-mock-db-v1:";
const PROJECTS_STORAGE_KEY = "loreforge-mock-projects-v1";

function dbStorageKey(projectId: string): string {
  return `${DB_STORAGE_KEY_PREFIX}${projectId}`;
}

interface MockDb {
  characters: Character[];
  relationships: Relationship[];
  events: Event[];
  canonEntries: CanonEntry[];
  locations: Location[];
  technologies: Technology[];
  species: Species[];
  militaryUnits: MilitaryUnit[];
  politicalEntities: PoliticalEntity[];
  religions: Religion[];
  organizations: Organization[];
  // A shared, append-only revision log that every entity type below writes
  // to on create/update/delete -- mirrors the real backend's `revisions`
  // table (design-phase-3-canon.md section 3.1), so RevisionHistoryPanel
  // can be developed/tested against the mock backend with the same
  // behavior as the real one.
  revisions: RevisionEntry[];
}

function seedDb(): MockDb {
  return {
    characters: [],
    relationships: [],
    events: [],
    canonEntries: [],
    locations: [],
    technologies: [],
    species: [],
    militaryUnits: [],
    politicalEntities: [],
    religions: [],
    organizations: [],
    revisions: [],
  };
}

/** Mirrors technologies::would_create_cycle in loreforge-core: true if
 * adding a `requires` edge from `dependentId` to `prerequisiteId` would
 * introduce a cycle anywhere in the technology dependency graph. Unlike
 * location reparenting (a single-parent chain walk), a technology can have
 * multiple prerequisites, so this is a bounded graph traversal: starting
 * from the candidate prerequisite, follow every outgoing `requires` edge;
 * if the walk ever reaches `dependentId`, the new edge would close a
 * cycle. */
function wouldCreateTechnologyCycle(dependentId: string, prerequisiteId: string): boolean {
  if (dependentId === prerequisiteId) return true;

  const seen = new Set<string>();
  const frontier: string[] = [prerequisiteId];

  while (frontier.length > 0) {
    const current = frontier.pop() as string;
    if (current === dependentId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const prereqIds = db.relationships
      .filter((r) => r.source_entity_id === current && r.relationship_type === REQUIRES)
      .map((r) => r.target_entity_id);
    frontier.push(...prereqIds);
  }

  return false;
}

/** Mirrors locations::would_create_cycle in loreforge-core: true if setting
 * `candidateId`'s parent to `newParentId` would make `candidateId` its own
 * ancestor (i.e. `newParentId` is `candidateId` itself or one of its own
 * descendants). Walking up from `newParentId`; if we ever reach
 * `candidateId`, the move would create a cycle. */
function wouldCreateLocationCycle(candidateId: string, newParentId: string): boolean {
  if (candidateId === newParentId) return true;

  const seen = new Set<string>();
  let currentId: string | null = newParentId;

  while (currentId !== null) {
    if (currentId === candidateId) return true;
    if (seen.has(currentId)) break; // pre-existing cycle elsewhere; don't loop forever
    seen.add(currentId);
    const current = db.locations.find((l) => l.id === currentId);
    currentId = current?.parent_location_id ?? null;
  }

  return false;
}

/** Mirrors species::would_create_cycle in loreforge-core: same
 * single-parent chain-walk as `wouldCreateLocationCycle` above (taxonomy
 * is a strict tree, per design-phase-6-species.md section 1), just walking
 * `db.species` / `parent_species_id` instead of `db.locations` /
 * `parent_location_id`. */
function wouldCreateSpeciesCycle(candidateId: string, newParentId: string): boolean {
  if (candidateId === newParentId) return true;

  const seen = new Set<string>();
  let currentId: string | null = newParentId;

  while (currentId !== null) {
    if (currentId === candidateId) return true;
    if (seen.has(currentId)) break; // pre-existing cycle elsewhere; don't loop forever
    seen.add(currentId);
    const current = db.species.find((s) => s.id === currentId);
    currentId = current?.parent_species_id ?? null;
  }

  return false;
}

/** Mirrors military::would_create_cycle in loreforge-core: the third copy
 * of this exact chain-walk shape (after wouldCreateLocationCycle and
 * wouldCreateSpeciesCycle), per design-phase-7-military.md section 3.2 --
 * chain of command is a strict tree, walking db.militaryUnits /
 * parent_unit_id. */
function wouldCreateMilitaryUnitCycle(candidateId: string, newParentId: string): boolean {
  if (candidateId === newParentId) return true;

  const seen = new Set<string>();
  let currentId: string | null = newParentId;

  while (currentId !== null) {
    if (currentId === candidateId) return true;
    if (seen.has(currentId)) break; // pre-existing cycle elsewhere; don't loop forever
    seen.add(currentId);
    const current = db.militaryUnits.find((u) => u.id === currentId);
    currentId = current?.parent_unit_id ?? null;
  }

  return false;
}

/** Mirrors religions::would_create_cycle in loreforge-core (which itself
 * delegates to the shared hierarchy.rs helper as of Phase 9). This
 * frontend mock layer has no equivalent Rust-side duplication to clean up
 * -- wouldCreateLocationCycle/wouldCreateSpeciesCycle/
 * wouldCreateMilitaryUnitCycle are three tiny standalone functions in
 * this one file already, so this is simply a fourth, following the same
 * shape (design-phase-9-religions.md section 4). */
function wouldCreateReligionCycle(candidateId: string, newParentId: string): boolean {
  if (candidateId === newParentId) return true;

  const seen = new Set<string>();
  let currentId: string | null = newParentId;

  while (currentId !== null) {
    if (currentId === candidateId) return true;
    if (seen.has(currentId)) break; // pre-existing cycle elsewhere; don't loop forever
    seen.add(currentId);
    const current = db.religions.find((r) => r.id === currentId);
    currentId = current?.parent_religion_id ?? null;
  }

  return false;
}

/** Mirrors organizations::would_create_cycle in loreforge-core: the fifth
 * copy of this exact chain-walk shape in this file (after
 * wouldCreateLocationCycle/wouldCreateSpeciesCycle/
 * wouldCreateMilitaryUnitCycle/wouldCreateReligionCycle), per
 * design-phase-10-organizations.md section 4.1 -- the frontend mock layer
 * still has no cross-module duplication problem to solve, so this stays a
 * fifth tiny standalone function rather than being generalized. */
function wouldCreateOrganizationCycle(candidateId: string, newParentId: string): boolean {
  if (candidateId === newParentId) return true;

  const seen = new Set<string>();
  let currentId: string | null = newParentId;

  while (currentId !== null) {
    if (currentId === candidateId) return true;
    if (seen.has(currentId)) break; // pre-existing cycle elsewhere; don't loop forever
    seen.add(currentId);
    const current = db.organizations.find((o) => o.id === currentId);
    currentId = current?.parent_organization_id ?? null;
  }

  return false;
}

/** Mirrors politics::find_edge_either_direction in loreforge-core:
 * direction-agnostic lookup for an existing edge of `relationshipType`
 * between `a` and `b` -- the piece that makes ALLIED_WITH/RIVAL_OF
 * symmetric despite the underlying array always storing a source/target
 * pair (design-phase-8-politics.md section 1.1, point 1). */
function findSymmetricEdge(
  a: string,
  b: string,
  relationshipType: string,
): Relationship | undefined {
  return db.relationships.find(
    (r) =>
      r.relationship_type === relationshipType &&
      ((r.source_entity_id === a && r.target_entity_id === b) ||
        (r.source_entity_id === b && r.target_entity_id === a)),
  );
}

let revisionCounter = 0;

/** Appends a revision row, mirroring loreforge_core::revisions::record.
 * Uses an incrementing counter (not just a timestamp) as part of the sort
 * key so that multiple revisions recorded within the same millisecond still
 * sort in true insertion order -- the same class of bug that was found and
 * fixed in the real backend's `list_for_record` (see
 * revisions.rs::list_for_record's comment on why `rowid` is needed). */
function recordRevision(
  entityId: string,
  action: RevisionEntry["action"],
  before: unknown,
  after: unknown,
) {
  revisionCounter += 1;
  db.revisions.push({
    id: `rev-${revisionCounter}`,
    entity_id: entityId,
    record_type: "entity",
    action,
    before_json: before ? JSON.stringify(before) : null,
    after_json: after ? JSON.stringify(after) : null,
    changed_at: new Date().toISOString(),
    note: null,
  });
}

function loadDb(projectId: string): MockDb {
  try {
    const raw = localStorage.getItem(dbStorageKey(projectId));
    if (raw) {
      // Merge with seedDb() so a mock DB persisted before newer fields
      // existed (e.g. `species`, added in Phase 6; `militaryUnits`, added
      // in Phase 7; `politicalEntities`, added in Phase 8; `religions`,
      // added in Phase 9; `organizations`, added in Phase 10) doesn't
      // crash with an undefined array -- same rationale as the original
      // Phase 1/2 note.
      return { ...seedDb(), ...(JSON.parse(raw) as Partial<MockDb>) };
    }
  } catch {
    // fall through to seed
  }
  return seedDb();
}

// No project is open until the picker opens/creates one (mirrors the real
// backend's in-memory placeholder connection at startup). `db` stays a
// throwaway empty dataset until then.
let activeProjectId: string | null = null;
let db: MockDb = seedDb();

/** Test-only escape hatch: reset the in-memory mock database. Without this,
 * `db` (a module-scope singleton) would keep state across tests even after
 * localStorage is cleared, since it's only read from localStorage once at
 * module import time. */
export function __resetMockDbForTests() {
  db = seedDb();
  activeProjectId = null;
  try {
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DB_STORAGE_KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function persist() {
  if (!activeProjectId) return;
  try {
    localStorage.setItem(dbStorageKey(activeProjectId), JSON.stringify(db));
  } catch {
    // ignore quota errors in mock mode
  }
}

// --- Mock project registry -------------------------------------------------
// Mirrors loreforge_core::projects (list/create/open/rename/delete), backed
// by its own localStorage key so it survives independently of any one
// project's dataset.

function loadProjectRegistry(): ProjectInfo[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ProjectInfo[];
  } catch {
    // fall through
  }
  return [];
}

function saveProjectRegistry(projects: ProjectInfo[]) {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore quota errors in mock mode
  }
}

// Simulate realistic async latency so the save-status indicator has
// something meaningful to show during development.
function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Direction-agnostic resolution of "the other side" of a symmetric
 * relationship for `entityId`, generalized (Phase 10) over which array to
 * resolve full records from -- mirrors the shared
 * `symmetric::list_symmetric_link_ids` in loreforge-core (extracted this
 * same phase; this is the frontend-mock counterpart, generalized the same
 * way `politics::list_symmetric_links` was generalized into
 * `symmetric::list_symmetric_link_ids` + per-module `get()` resolution --
 * design-phase-10-organizations.md section 1.1). Callers pass their own
 * full-record array (`db.politicalEntities`, `db.organizations`, etc.) so
 * this function has no knowledge of any specific entity type. */
function listSymmetricLinks<T extends { id: string }>(
  records: T[],
  entityId: string,
  relationshipType: string,
): Promise<T[]> {
  const links = db.relationships.filter(
    (r) =>
      r.relationship_type === relationshipType &&
      (r.source_entity_id === entityId || r.target_entity_id === entityId),
  );
  const otherIds = links.map((r) =>
    r.source_entity_id === entityId ? r.target_entity_id : r.source_entity_id,
  );
  return delay(records.filter((p) => otherIds.includes(p.id)));
}

/** Generalized counterpart to `createSymmetricEdge`'s validation, shared
 * across Politics and Organizations (Phase 10) -- mirrors the Rust-side
 * `symmetric::create_symmetric_edge`. Takes the pair of mutually-exclusive
 * relationship-type strings as parameters rather than being duplicated
 * once per entity type. */
async function createMockSymmetricEdge(
  a: string,
  b: string,
  relationshipType: string,
  opposite: string,
): Promise<Relationship> {
  if (a === b) {
    throw new Error(`an entity cannot be its own ${relationshipType}`);
  }
  if (findSymmetricEdge(a, b, relationshipType)) {
    throw new Error(`these entities are already linked as ${relationshipType}`);
  }
  if (findSymmetricEdge(a, b, opposite)) {
    throw new Error(
      `these entities are already linked as ${opposite}; a pair cannot be both ${relationshipType} and ${opposite}`,
    );
  }
  return mockApi.relationships.create({
    source_entity_id: a,
    target_entity_id: b,
    relationship_type: relationshipType,
  });
}

export const mockApi = {
  projects: {
    async list(): Promise<ProjectInfo[]> {
      return delay(loadProjectRegistry());
    },
    async create(name: string): Promise<ProjectInfo> {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("project name is required");

      const ts = now();
      const info: ProjectInfo = {
        id: genId(),
        name: trimmed,
        created_at: ts,
        last_opened_at: ts,
      };
      const projects = loadProjectRegistry();
      projects.push(info);
      saveProjectRegistry(projects);

      activeProjectId = info.id;
      db = loadDb(info.id);

      return delay(info);
    },
    async open(id: string): Promise<ProjectInfo> {
      const projects = loadProjectRegistry();
      const project = projects.find((p) => p.id === id);
      if (!project) throw new Error(`project ${id} not found`);
      project.last_opened_at = now();
      saveProjectRegistry(projects);

      activeProjectId = id;
      db = loadDb(id);

      return delay(project);
    },
    async rename(id: string, name: string): Promise<ProjectInfo> {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("project name is required");

      const projects = loadProjectRegistry();
      const project = projects.find((p) => p.id === id);
      if (!project) throw new Error(`project ${id} not found`);
      project.name = trimmed;
      saveProjectRegistry(projects);

      return delay(project);
    },
    async delete(id: string): Promise<void> {
      const projects = loadProjectRegistry().filter((p) => p.id !== id);
      saveProjectRegistry(projects);
      try {
        localStorage.removeItem(dbStorageKey(id));
      } catch {
        // ignore
      }
      if (activeProjectId === id) {
        activeProjectId = null;
        db = seedDb();
      }
      return delay(undefined);
    },
  },
  characters: {
    async list(filter: CharacterFilter = {}): Promise<Character[]> {
      let results = db.characters;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((c) => c.name.toLowerCase().includes(q));
      }
      if (filter.role) {
        results = results.filter((c) => c.role === filter.role);
      }
      if (filter.status) {
        results = results.filter((c) => c.status === filter.status);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<Character> {
      const found = db.characters.find((c) => c.id === id);
      if (!found) throw new Error(`character ${id} not found`);
      return delay(found);
    },
    async create(input: NewCharacter): Promise<Character> {
      if (!input.name.trim()) throw new Error("character name is required");
      const character: Character = {
        id: uuid(),
        name: input.name,
        role: input.role ?? "supporting",
        status: input.status ?? "alive",
        biography: input.biography ?? "",
        appearance: input.appearance ?? "",
        goals: input.goals ?? "",
        needs: input.needs ?? "",
        flaws: input.flaws ?? "",
        secrets: input.secrets ?? "",
        psychology: input.psychology ?? "",
        dialogue_style: input.dialogue_style ?? "",
        tags: input.tags ?? [],
        needs_development: false,
        created_at: now(),
        updated_at: now(),
      };
      db.characters.push(character);
      recordRevision(character.id, "create", null, character);
      persist();
      return delay(character);
    },
    async update(id: string, patch: CharacterPatch): Promise<Character> {
      const character = db.characters.find((c) => c.id === id);
      if (!character) throw new Error(`character ${id} not found`);
      const before = { ...character };
      Object.assign(character, patch, { updated_at: now() });
      recordRevision(id, "update", before, character);
      persist();
      return delay(character);
    },
    async delete(id: string): Promise<void> {
      const before = db.characters.find((c) => c.id === id);
      db.characters = db.characters.filter((c) => c.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      if (before) recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
  },
  relationships: {
    async listAll(): Promise<Relationship[]> {
      return delay(db.relationships);
    },
    async listForEntity(entityId: string): Promise<Relationship[]> {
      return delay(
        db.relationships.filter(
          (r) => r.source_entity_id === entityId || r.target_entity_id === entityId,
        ),
      );
    },
    async create(input: NewRelationship): Promise<Relationship> {
      if (input.source_entity_id === input.target_entity_id) {
        throw new Error("a relationship cannot connect an entity to itself");
      }
      const relationship: Relationship = {
        id: uuid(),
        source_entity_id: input.source_entity_id,
        target_entity_id: input.target_entity_id,
        relationship_type: input.relationship_type,
        label: input.label ?? null,
        strength: input.strength ?? 0.5,
        created_at: now(),
        updated_at: now(),
      };
      db.relationships.push(relationship);
      persist();
      return delay(relationship);
    },
    async update(id: string, patch: RelationshipPatch): Promise<Relationship> {
      const relationship = db.relationships.find((r) => r.id === id);
      if (!relationship) throw new Error(`relationship ${id} not found`);
      Object.assign(relationship, patch, { updated_at: now() });
      persist();
      return delay(relationship);
    },
    async delete(id: string): Promise<void> {
      db.relationships = db.relationships.filter((r) => r.id !== id);
      persist();
      return delay(undefined);
    },
  },
  events: {
    async list(filter: EventFilter = {}): Promise<Event[]> {
      let results = db.events;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((e) => e.name.toLowerCase().includes(q));
      }
      if (filter.layer) {
        results = results.filter((e) => e.layers.includes(filter.layer as string));
      }
      results = [...results].sort((a, b) => a.start_date.localeCompare(b.start_date));
      return delay(results);
    },
    async get(id: string): Promise<Event> {
      const found = db.events.find((e) => e.id === id);
      if (!found) throw new Error(`event ${id} not found`);
      return delay(found);
    },
    async create(input: NewEvent): Promise<Event> {
      if (!input.name.trim()) throw new Error("event name is required");
      if (!input.start_date?.trim()) throw new Error("event start_date is required");
      if (input.end_date && input.end_date < input.start_date) {
        throw new Error("event end_date cannot be before start_date");
      }
      const event: Event = {
        id: uuid(),
        name: input.name,
        description: input.description ?? "",
        layers: input.layers ?? [],
        start_date: input.start_date,
        end_date: input.end_date ?? null,
        date_precision: input.date_precision ?? "day",
        significance: input.significance ?? "minor",
        created_at: now(),
        updated_at: now(),
      };
      db.events.push(event);
      recordRevision(event.id, "create", null, event);
      persist();
      return delay(event);
    },
    async update(id: string, patch: EventPatch): Promise<Event> {
      const event = db.events.find((e) => e.id === id);
      if (!event) throw new Error(`event ${id} not found`);
      const nextStart = patch.start_date ?? event.start_date;
      const nextEnd = patch.end_date !== undefined ? patch.end_date : event.end_date;
      if (nextEnd && nextEnd < nextStart) {
        throw new Error("event end_date cannot be before start_date");
      }
      const before = { ...event };
      Object.assign(event, patch, { updated_at: now() });
      recordRevision(id, "update", before, event);
      persist();
      return delay(event);
    },
    async delete(id: string): Promise<void> {
      const before = db.events.find((e) => e.id === id);
      db.events = db.events.filter((e) => e.id !== id);
      // Cascade: remove relationships touching this event, but leave any
      // characters (or other entities) untouched -- mirrors
      // events::delete in loreforge-core (FR2.3/FR2.4).
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      if (before) recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
  },
  canon: {
    async list(filter: CanonFilter = {}): Promise<CanonEntry[]> {
      let results = db.canonEntries;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((c) => c.name.toLowerCase().includes(q));
      }
      if (filter.status) {
        results = results.filter((c) => c.status === filter.status);
      }
      if (filter.category) {
        results = results.filter((c) => c.category === filter.category);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<CanonEntry> {
      const found = db.canonEntries.find((c) => c.id === id);
      if (!found) throw new Error(`canon entry ${id} not found`);
      return delay(found);
    },
    async create(input: NewCanonEntry): Promise<CanonEntry> {
      if (!input.name.trim()) throw new Error("canon entry name is required");
      const entry: CanonEntry = {
        id: uuid(),
        name: input.name,
        description: input.description ?? "",
        category: input.category ?? "",
        status: input.status ?? "draft",
        version: 1,
        notes: input.notes ?? "",
        created_at: now(),
        updated_at: now(),
      };
      db.canonEntries.push(entry);
      recordRevision(entry.id, "create", null, entry);
      persist();
      return delay(entry);
    },
    async update(id: string, patch: CanonEntryPatch): Promise<CanonEntry> {
      const entry = db.canonEntries.find((c) => c.id === id);
      if (!entry) throw new Error(`canon entry ${id} not found`);
      const before = { ...entry };
      const hasContentChange =
        patch.name !== undefined ||
        patch.description !== undefined ||
        patch.category !== undefined ||
        patch.status !== undefined ||
        patch.notes !== undefined;
      Object.assign(entry, patch, { updated_at: now() });
      // Every content change bumps version by exactly 1 -- mirrors
      // canon::update in loreforge-core (FR1.4/NFR2).
      if (hasContentChange) entry.version += 1;
      recordRevision(id, "update", before, entry);
      persist();
      return delay(entry);
    },
    async delete(id: string): Promise<void> {
      const before = db.canonEntries.find((c) => c.id === id);
      db.canonEntries = db.canonEntries.filter((c) => c.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      if (before) recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
  },
  revisions: {
    async listForEntity(entityId: string, limit: number = 50): Promise<RevisionEntry[]> {
      const matches = db.revisions.filter((r) => r.entity_id === entityId);
      // Newest first, matching the real backend's ORDER BY changed_at DESC,
      // rowid DESC -- array insertion order here plays the role rowid plays
      // in SQLite, so a simple reverse is sufficient and correct.
      const newestFirst = [...matches].reverse();
      return delay(newestFirst.slice(0, limit));
    },
  },
  locations: {
    async list(filter: LocationFilter = {}): Promise<Location[]> {
      let results = db.locations;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((l) => l.name.toLowerCase().includes(q));
      }
      if (filter.location_type) {
        results = results.filter((l) => l.location_type === filter.location_type);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<Location> {
      const found = db.locations.find((l) => l.id === id);
      if (!found) throw new Error(`location ${id} not found`);
      return delay(found);
    },
    async create(input: NewLocation): Promise<Location> {
      if (!input.name.trim()) throw new Error("location name is required");
      if (input.parent_location_id) {
        const parentExists = db.locations.some((l) => l.id === input.parent_location_id);
        if (!parentExists) throw new Error(`parent location ${input.parent_location_id} not found`);
      }
      const location: Location = {
        id: uuid(),
        name: input.name,
        location_type: input.location_type ?? "other",
        description: input.description ?? "",
        parent_location_id: input.parent_location_id ?? null,
        created_at: now(),
        updated_at: now(),
      };
      db.locations.push(location);
      recordRevision(location.id, "create", null, location);
      persist();
      return delay(location);
    },
    async update(id: string, patch: LocationPatch): Promise<Location> {
      const location = db.locations.find((l) => l.id === id);
      if (!location) throw new Error(`location ${id} not found`);

      if (patch.parent_location_id !== undefined && patch.parent_location_id !== null) {
        const newParentId = patch.parent_location_id;
        const parentExists = db.locations.some((l) => l.id === newParentId);
        if (!parentExists) throw new Error(`parent location ${newParentId} not found`);
        if (wouldCreateLocationCycle(id, newParentId)) {
          throw new Error(
            "cannot move a location to become a child of itself or one of its own descendants",
          );
        }
      }

      const before = { ...location };
      Object.assign(location, patch, { updated_at: now() });
      recordRevision(id, "update", before, location);
      persist();
      return delay(location);
    },
    async delete(id: string): Promise<void> {
      const before = db.locations.find((l) => l.id === id);
      if (!before) return delay(undefined);

      // Reparent direct children up one level (to the deleted location's
      // own parent, or to root) rather than orphaning/cascade-deleting the
      // subtree -- mirrors locations::delete in loreforge-core (FR3.1).
      for (const child of db.locations) {
        if (child.parent_location_id === id) {
          child.parent_location_id = before.parent_location_id;
        }
      }

      db.locations = db.locations.filter((l) => l.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
    async listChildren(parentId: string | null): Promise<Location[]> {
      const results = db.locations
        .filter((l) => l.parent_location_id === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async getAncestryChain(id: string): Promise<Location[]> {
      const chain: Location[] = [];
      const seen = new Set<string>();
      let currentId = db.locations.find((l) => l.id === id)?.parent_location_id ?? null;

      while (currentId !== null) {
        if (seen.has(currentId)) break;
        seen.add(currentId);
        const parent = db.locations.find((l) => l.id === currentId);
        if (!parent) break;
        chain.push(parent);
        currentId = parent.parent_location_id;
      }

      return delay(chain);
    },
  },
  technologies: {
    async list(filter: TechnologyFilter = {}): Promise<Technology[]> {
      let results = db.technologies;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((t) => t.name.toLowerCase().includes(q));
      }
      if (filter.category) {
        results = results.filter((t) => t.category === filter.category);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<Technology> {
      const found = db.technologies.find((t) => t.id === id);
      if (!found) throw new Error(`technology ${id} not found`);
      return delay(found);
    },
    async create(input: NewTechnology): Promise<Technology> {
      if (!input.name.trim()) throw new Error("technology name is required");
      const technology: Technology = {
        id: uuid(),
        name: input.name,
        category: input.category ?? "other",
        description: input.description ?? "",
        introduced_date: input.introduced_date ?? null,
        date_precision: input.date_precision ?? "day",
        created_at: now(),
        updated_at: now(),
      };
      db.technologies.push(technology);
      recordRevision(technology.id, "create", null, technology);
      persist();
      return delay(technology);
    },
    async update(id: string, patch: TechnologyPatch): Promise<Technology> {
      const technology = db.technologies.find((t) => t.id === id);
      if (!technology) throw new Error(`technology ${id} not found`);
      const before = { ...technology };
      Object.assign(technology, patch, { updated_at: now() });
      recordRevision(id, "update", before, technology);
      persist();
      return delay(technology);
    },
    async delete(id: string): Promise<void> {
      const before = db.technologies.find((t) => t.id === id);
      db.technologies = db.technologies.filter((t) => t.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      if (before) recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
    async listPrerequisites(technologyId: string): Promise<Technology[]> {
      const prereqIds = db.relationships
        .filter((r) => r.source_entity_id === technologyId && r.relationship_type === REQUIRES)
        .map((r) => r.target_entity_id);
      return delay(db.technologies.filter((t) => prereqIds.includes(t.id)));
    },
    async listDependents(technologyId: string): Promise<Technology[]> {
      const dependentIds = db.relationships
        .filter((r) => r.target_entity_id === technologyId && r.relationship_type === REQUIRES)
        .map((r) => r.source_entity_id);
      return delay(db.technologies.filter((t) => dependentIds.includes(t.id)));
    },
    async createRequiresEdge(dependentId: string, prerequisiteId: string): Promise<Relationship> {
      if (wouldCreateTechnologyCycle(dependentId, prerequisiteId)) {
        throw new Error("this dependency would create a cycle in the technology tree");
      }
      return mockApi.relationships.create({
        source_entity_id: dependentId,
        target_entity_id: prerequisiteId,
        relationship_type: REQUIRES,
      });
    },
  },
  species: {
    async list(filter: SpeciesFilter = {}): Promise<Species[]> {
      let results = db.species;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((s) => s.name.toLowerCase().includes(q));
      }
      if (filter.classification) {
        results = results.filter((s) => s.classification === filter.classification);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<Species> {
      const found = db.species.find((s) => s.id === id);
      if (!found) throw new Error(`species ${id} not found`);
      return delay(found);
    },
    async create(input: NewSpecies): Promise<Species> {
      if (!input.name.trim()) throw new Error("species name is required");
      if (input.parent_species_id) {
        const parentExists = db.species.some((s) => s.id === input.parent_species_id);
        if (!parentExists) throw new Error(`parent species ${input.parent_species_id} not found`);
      }
      const species: Species = {
        id: uuid(),
        name: input.name,
        classification: input.classification ?? "other",
        biology: input.biology ?? "",
        parent_species_id: input.parent_species_id ?? null,
        created_at: now(),
        updated_at: now(),
      };
      db.species.push(species);
      recordRevision(species.id, "create", null, species);
      persist();
      return delay(species);
    },
    async update(id: string, patch: SpeciesPatch): Promise<Species> {
      const species = db.species.find((s) => s.id === id);
      if (!species) throw new Error(`species ${id} not found`);

      if (patch.parent_species_id !== undefined && patch.parent_species_id !== null) {
        const newParentId = patch.parent_species_id;
        const parentExists = db.species.some((s) => s.id === newParentId);
        if (!parentExists) throw new Error(`parent species ${newParentId} not found`);
        if (wouldCreateSpeciesCycle(id, newParentId)) {
          throw new Error(
            "cannot set a species' parent to itself or one of its own descendants",
          );
        }
      }

      const before = { ...species };
      Object.assign(species, patch, { updated_at: now() });
      recordRevision(id, "update", before, species);
      persist();
      return delay(species);
    },
    async delete(id: string): Promise<void> {
      const before = db.species.find((s) => s.id === id);
      if (!before) return delay(undefined);

      // Reparent direct subspecies up one level (to the deleted species'
      // own parent, or to root) rather than orphaning/cascade-deleting the
      // subtree -- mirrors species::delete in loreforge-core (FR3.1).
      for (const child of db.species) {
        if (child.parent_species_id === id) {
          child.parent_species_id = before.parent_species_id;
        }
      }

      db.species = db.species.filter((s) => s.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
    async listSubspecies(parentId: string | null): Promise<Species[]> {
      const results = db.species
        .filter((s) => s.parent_species_id === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
  },
  military: {
    async list(filter: MilitaryUnitFilter = {}): Promise<MilitaryUnit[]> {
      let results = db.militaryUnits;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((u) => u.name.toLowerCase().includes(q));
      }
      if (filter.branch) {
        results = results.filter((u) => u.branch === filter.branch);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<MilitaryUnit> {
      const found = db.militaryUnits.find((u) => u.id === id);
      if (!found) throw new Error(`military unit ${id} not found`);
      return delay(found);
    },
    async create(input: NewMilitaryUnit): Promise<MilitaryUnit> {
      if (!input.name.trim()) throw new Error("military unit name is required");
      if (input.parent_unit_id) {
        const parentExists = db.militaryUnits.some((u) => u.id === input.parent_unit_id);
        if (!parentExists) throw new Error(`parent unit ${input.parent_unit_id} not found`);
      }
      const unit: MilitaryUnit = {
        id: uuid(),
        name: input.name,
        branch: input.branch ?? "other",
        doctrine: input.doctrine ?? "",
        parent_unit_id: input.parent_unit_id ?? null,
        created_at: now(),
        updated_at: now(),
      };
      db.militaryUnits.push(unit);
      recordRevision(unit.id, "create", null, unit);
      persist();
      return delay(unit);
    },
    async update(id: string, patch: MilitaryUnitPatch): Promise<MilitaryUnit> {
      const unit = db.militaryUnits.find((u) => u.id === id);
      if (!unit) throw new Error(`military unit ${id} not found`);

      if (patch.parent_unit_id !== undefined && patch.parent_unit_id !== null) {
        const newParentId = patch.parent_unit_id;
        const parentExists = db.militaryUnits.some((u) => u.id === newParentId);
        if (!parentExists) throw new Error(`parent unit ${newParentId} not found`);
        if (wouldCreateMilitaryUnitCycle(id, newParentId)) {
          throw new Error(
            "cannot set a unit's parent to itself or one of its own subordinate units",
          );
        }
      }

      const before = { ...unit };
      Object.assign(unit, patch, { updated_at: now() });
      recordRevision(id, "update", before, unit);
      persist();
      return delay(unit);
    },
    async delete(id: string): Promise<void> {
      const before = db.militaryUnits.find((u) => u.id === id);
      if (!before) return delay(undefined);

      // Reparent direct subordinate units up one level (to the deleted
      // unit's own parent, or to root) rather than orphaning/cascade
      // -deleting the subtree -- mirrors military::delete in
      // loreforge-core (FR3.1).
      for (const child of db.militaryUnits) {
        if (child.parent_unit_id === id) {
          child.parent_unit_id = before.parent_unit_id;
        }
      }

      db.militaryUnits = db.militaryUnits.filter((u) => u.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
    async listSubordinateUnits(parentId: string | null): Promise<MilitaryUnit[]> {
      const results = db.militaryUnits
        .filter((u) => u.parent_unit_id === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
  },
  politics: {
    async list(filter: PoliticalEntityFilter = {}): Promise<PoliticalEntity[]> {
      let results = db.politicalEntities;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((p) => p.name.toLowerCase().includes(q));
      }
      if (filter.classification) {
        results = results.filter((p) => p.classification === filter.classification);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<PoliticalEntity> {
      const found = db.politicalEntities.find((p) => p.id === id);
      if (!found) throw new Error(`political entity ${id} not found`);
      return delay(found);
    },
    async create(input: NewPoliticalEntity): Promise<PoliticalEntity> {
      if (!input.name.trim()) throw new Error("political entity name is required");
      const entity: PoliticalEntity = {
        id: uuid(),
        name: input.name,
        classification: input.classification ?? "other",
        ideology: input.ideology ?? "",
        founded_date: input.founded_date ?? null,
        date_precision: input.date_precision ?? "day",
        created_at: now(),
        updated_at: now(),
      };
      db.politicalEntities.push(entity);
      recordRevision(entity.id, "create", null, entity);
      persist();
      return delay(entity);
    },
    async update(id: string, patch: PoliticalEntityPatch): Promise<PoliticalEntity> {
      const entity = db.politicalEntities.find((p) => p.id === id);
      if (!entity) throw new Error(`political entity ${id} not found`);
      const before = { ...entity };
      Object.assign(entity, patch, { updated_at: now() });
      recordRevision(id, "update", before, entity);
      persist();
      return delay(entity);
    },
    async delete(id: string): Promise<void> {
      const before = db.politicalEntities.find((p) => p.id === id);
      db.politicalEntities = db.politicalEntities.filter((p) => p.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      if (before) recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
    /** Delegates to the shared `createMockSymmetricEdge` (generalized in
     * Phase 10 -- see design-phase-10-organizations.md section 1.1; this
     * function previously had its own copy of the validation, written in
     * Phase 8). */
    async createSymmetricEdge(
      a: string,
      b: string,
      relationshipType: string,
    ): Promise<Relationship> {
      if (relationshipType !== ALLIED_WITH && relationshipType !== RIVAL_OF) {
        throw new Error(`unsupported symmetric relationship type '${relationshipType}'`);
      }
      const opposite = relationshipType === ALLIED_WITH ? RIVAL_OF : ALLIED_WITH;
      return createMockSymmetricEdge(a, b, relationshipType, opposite);
    },
    async listAllies(entityId: string): Promise<PoliticalEntity[]> {
      return listSymmetricLinks(db.politicalEntities, entityId, ALLIED_WITH);
    },
    async listRivals(entityId: string): Promise<PoliticalEntity[]> {
      return listSymmetricLinks(db.politicalEntities, entityId, RIVAL_OF);
    },
  },
  religions: {
    async list(filter: ReligionFilter = {}): Promise<Religion[]> {
      let results = db.religions;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((r) => r.name.toLowerCase().includes(q));
      }
      if (filter.classification) {
        results = results.filter((r) => r.classification === filter.classification);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<Religion> {
      const found = db.religions.find((r) => r.id === id);
      if (!found) throw new Error(`religion ${id} not found`);
      return delay(found);
    },
    async create(input: NewReligion): Promise<Religion> {
      if (!input.name.trim()) throw new Error("religion name is required");
      if (input.parent_religion_id) {
        const parentExists = db.religions.some((r) => r.id === input.parent_religion_id);
        if (!parentExists) throw new Error(`parent religion ${input.parent_religion_id} not found`);
      }
      const religion: Religion = {
        id: uuid(),
        name: input.name,
        classification: input.classification ?? "other",
        tenets: input.tenets ?? "",
        parent_religion_id: input.parent_religion_id ?? null,
        created_at: now(),
        updated_at: now(),
      };
      db.religions.push(religion);
      recordRevision(religion.id, "create", null, religion);
      persist();
      return delay(religion);
    },
    async update(id: string, patch: ReligionPatch): Promise<Religion> {
      const religion = db.religions.find((r) => r.id === id);
      if (!religion) throw new Error(`religion ${id} not found`);

      if (patch.parent_religion_id !== undefined && patch.parent_religion_id !== null) {
        const newParentId = patch.parent_religion_id;
        const parentExists = db.religions.some((r) => r.id === newParentId);
        if (!parentExists) throw new Error(`parent religion ${newParentId} not found`);
        if (wouldCreateReligionCycle(id, newParentId)) {
          throw new Error(
            "cannot set a religion's parent to itself or one of its own schisms",
          );
        }
      }

      const before = { ...religion };
      Object.assign(religion, patch, { updated_at: now() });
      recordRevision(id, "update", before, religion);
      persist();
      return delay(religion);
    },
    async delete(id: string): Promise<void> {
      const before = db.religions.find((r) => r.id === id);
      if (!before) return delay(undefined);

      // Reparent direct schisms up one level (to the deleted religion's
      // own parent, or to root) rather than orphaning/cascade-deleting the
      // subtree -- mirrors religions::delete in loreforge-core (FR3.3).
      for (const child of db.religions) {
        if (child.parent_religion_id === id) {
          child.parent_religion_id = before.parent_religion_id;
        }
      }

      db.religions = db.religions.filter((r) => r.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
    async listSchisms(parentId: string | null): Promise<Religion[]> {
      const results = db.religions
        .filter((r) => r.parent_religion_id === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
  },
  organizations: {
    async list(filter: OrganizationFilter = {}): Promise<Organization[]> {
      let results = db.organizations;
      if (filter.search?.trim()) {
        const q = filter.search.trim().toLowerCase();
        results = results.filter((o) => o.name.toLowerCase().includes(q));
      }
      if (filter.classification) {
        results = results.filter((o) => o.classification === filter.classification);
      }
      results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    async get(id: string): Promise<Organization> {
      const found = db.organizations.find((o) => o.id === id);
      if (!found) throw new Error(`organization ${id} not found`);
      return delay(found);
    },
    async create(input: NewOrganization): Promise<Organization> {
      if (!input.name.trim()) throw new Error("organization name is required");
      if (input.parent_organization_id) {
        const parentExists = db.organizations.some((o) => o.id === input.parent_organization_id);
        if (!parentExists) throw new Error(`parent organization ${input.parent_organization_id} not found`);
      }
      const organization: Organization = {
        id: uuid(),
        name: input.name,
        classification: input.classification ?? "other",
        charter: input.charter ?? "",
        parent_organization_id: input.parent_organization_id ?? null,
        created_at: now(),
        updated_at: now(),
      };
      db.organizations.push(organization);
      recordRevision(organization.id, "create", null, organization);
      persist();
      return delay(organization);
    },
    async update(id: string, patch: OrganizationPatch): Promise<Organization> {
      const organization = db.organizations.find((o) => o.id === id);
      if (!organization) throw new Error(`organization ${id} not found`);

      if (patch.parent_organization_id !== undefined && patch.parent_organization_id !== null) {
        const newParentId = patch.parent_organization_id;
        const parentExists = db.organizations.some((o) => o.id === newParentId);
        if (!parentExists) throw new Error(`parent organization ${newParentId} not found`);
        if (wouldCreateOrganizationCycle(id, newParentId)) {
          throw new Error(
            "cannot set an organization's parent to itself or one of its own subsidiaries",
          );
        }
      }

      const before = { ...organization };
      Object.assign(organization, patch, { updated_at: now() });
      recordRevision(id, "update", before, organization);
      persist();
      return delay(organization);
    },
    async delete(id: string): Promise<void> {
      const before = db.organizations.find((o) => o.id === id);
      if (!before) return delay(undefined);

      // Reparent direct subsidiaries up one level (to the deleted
      // organization's own parent, or to root) rather than
      // orphaning/cascade-deleting the subtree -- mirrors
      // organizations::delete in loreforge-core (FR3.3).
      for (const child of db.organizations) {
        if (child.parent_organization_id === id) {
          child.parent_organization_id = before.parent_organization_id;
        }
      }

      db.organizations = db.organizations.filter((o) => o.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      recordRevision(id, "delete", before, null);
      persist();
      return delay(undefined);
    },
    async listSubsidiaries(parentId: string | null): Promise<Organization[]> {
      const results = db.organizations
        .filter((o) => o.parent_organization_id === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
      return delay(results);
    },
    /** Delegates to the shared `createMockSymmetricEdge`, the second
     * consumer alongside Politics (design-phase-10-organizations.md
     * section 1.1). */
    async createSymmetricEdge(
      a: string,
      b: string,
      relationshipType: string,
    ): Promise<Relationship> {
      if (relationshipType !== ORG_ALLIED_WITH && relationshipType !== ORG_RIVAL_OF) {
        throw new Error(`unsupported symmetric relationship type '${relationshipType}'`);
      }
      const opposite = relationshipType === ORG_ALLIED_WITH ? ORG_RIVAL_OF : ORG_ALLIED_WITH;
      return createMockSymmetricEdge(a, b, relationshipType, opposite);
    },
    async listAllies(entityId: string): Promise<Organization[]> {
      return listSymmetricLinks(db.organizations, entityId, ORG_ALLIED_WITH);
    },
    async listRivals(entityId: string): Promise<Organization[]> {
      return listSymmetricLinks(db.organizations, entityId, ORG_RIVAL_OF);
    },
  },
  dashboard: {
    async getMetrics(): Promise<DashboardMetrics> {
      const layersInUse = new Set<string>();
      let earliest: string | null = null;
      let latest: string | null = null;
      for (const event of db.events) {
        for (const layer of event.layers) layersInUse.add(layer);
        if (earliest === null || event.start_date < earliest) earliest = event.start_date;
        const comparableEnd = event.end_date ?? event.start_date;
        if (latest === null || comparableEnd > latest) latest = comparableEnd;
      }
      const locationTypesInUse = new Set(db.locations.map((l) => l.location_type));
      const technologyCategoriesInUse = new Set(db.technologies.map((t) => t.category));
      const speciesClassificationsInUse = new Set(db.species.map((s) => s.classification));
      const militaryBranchesInUse = new Set(db.militaryUnits.map((u) => u.branch));
      const politicalClassificationsInUse = new Set(db.politicalEntities.map((p) => p.classification));
      const religionClassificationsInUse = new Set(db.religions.map((r) => r.classification));
      const organizationClassificationsInUse = new Set(db.organizations.map((o) => o.classification));
      return delay({
        characters_total: db.characters.length,
        characters_main: db.characters.filter((c) => c.role === "main").length,
        characters_supporting: db.characters.filter((c) => c.role === "supporting").length,
        characters_needs_development: db.characters.filter((c) => c.needs_development).length,
        relationships_total: db.relationships.length,
        events_total: db.events.length,
        layers_in_use: layersInUse.size,
        earliest_event_date: earliest,
        latest_event_date: latest,
        canon_approved: db.canonEntries.filter((c) => c.status === "approved").length,
        canon_draft: db.canonEntries.filter((c) => c.status === "draft").length,
        canon_under_review: db.canonEntries.filter((c) => c.status === "under_review").length,
        canon_deprecated: db.canonEntries.filter((c) => c.status === "deprecated").length,
        locations_total: db.locations.length,
        location_types_in_use: locationTypesInUse.size,
        technologies_total: db.technologies.length,
        technology_categories_in_use: technologyCategoriesInUse.size,
        species_total: db.species.length,
        species_classifications_in_use: speciesClassificationsInUse.size,
        military_units_total: db.militaryUnits.length,
        military_branches_in_use: militaryBranchesInUse.size,
        political_entities_total: db.politicalEntities.length,
        political_classifications_in_use: politicalClassificationsInUse.size,
        religions_total: db.religions.length,
        religion_classifications_in_use: religionClassificationsInUse.size,
        organizations_total: db.organizations.length,
        organization_classifications_in_use: organizationClassificationsInUse.size,
      });
    },
  },
};
