// A tiny in-memory mock of the Tauri backend, used ONLY when the app is
// running outside of a real Tauri window (e.g. `npm run dev` in a plain
// browser for UI iteration). It mirrors the exact behavior of
// crates/loreforge-core so the UI layer is developed/tested against the
// same contract it will use in the real native app.
//
// This is intentionally kept separate from lib/tauri.ts: production/native
// builds never import this file's logic path (see lib/api.ts).

import type {
  Character,
  CharacterFilter,
  CharacterPatch,
  DashboardMetrics,
  Event,
  EventFilter,
  EventPatch,
  NewCharacter,
  NewEvent,
  NewRelationship,
  Relationship,
  RelationshipPatch,
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
}

function seedDb(): MockDb {
  return { characters: [], relationships: [], events: [] };
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
      persist();
      return delay(character);
    },
    async update(id: string, patch: CharacterPatch): Promise<Character> {
      const character = db.characters.find((c) => c.id === id);
      if (!character) throw new Error(`character ${id} not found`);
      Object.assign(character, patch, { updated_at: now() });
      persist();
      return delay(character);
    },
    async delete(id: string): Promise<void> {
      db.characters = db.characters.filter((c) => c.id !== id);
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
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
      Object.assign(event, patch, { updated_at: now() });
      persist();
      return delay(event);
    },
    async delete(id: string): Promise<void> {
      db.events = db.events.filter((e) => e.id !== id);
      // Cascade: remove relationships touching this event, but leave any
      // characters (or other entities) untouched -- mirrors
      // events::delete in loreforge-core (FR2.3/FR2.4).
      db.relationships = db.relationships.filter(
        (r) => r.source_entity_id !== id && r.target_entity_id !== id,
      );
      persist();
      return delay(undefined);
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
      });
    },
  },
};
