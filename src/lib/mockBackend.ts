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
  NewCanonEntry,
  NewCharacter,
  NewEvent,
  NewLocation,
  NewRelationship,
  Relationship,
  RelationshipPatch,
  RevisionEntry,
} from "./types";

function uuid(): string {
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now(): string {
  return new Date().toISOString();
}

const STORAGE_KEY = "loreforge-mock-db-v1";

interface MockDb {
  characters: Character[];
  relationships: Relationship[];
  events: Event[];
  canonEntries: CanonEntry[];
  locations: Location[];
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
    revisions: [],
  };
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

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Merge with seedDb() so a mock DB persisted before the `events` field
      // existed (Phase 1) doesn't crash Phase 2 code with an undefined array.
      return { ...seedDb(), ...(JSON.parse(raw) as Partial<MockDb>) };
    }
  } catch {
    // fall through to seed
  }
  return seedDb();
}

let db: MockDb = loadDb();

/** Test-only escape hatch: reset the in-memory mock database. Without this,
 * `db` (a module-scope singleton) would keep state across tests even after
 * localStorage is cleared, since it's only read from localStorage once at
 * module import time. */
export function __resetMockDbForTests() {
  db = seedDb();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors in mock mode
  }
}

// Simulate realistic async latency so the save-status indicator has
// something meaningful to show during development.
function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockApi = {
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
      });
    },
  },
};
