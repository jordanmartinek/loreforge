-- Core spine: every worldbuilding object is an `entity`, with type-specific
-- detail rows bolted on. This lets future phases add new entity types
-- (locations, technology, species, ...) without touching this schema.

CREATE TABLE entities (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
);

CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_deleted ON entities(deleted_at);

-- Typed, directional relationships between any two entities.
CREATE TABLE relationships (
    id                TEXT PRIMARY KEY,
    source_entity_id  TEXT NOT NULL REFERENCES entities(id),
    target_entity_id  TEXT NOT NULL REFERENCES entities(id),
    relationship_type TEXT NOT NULL,
    label             TEXT,
    strength          REAL NOT NULL DEFAULT 0.5,
    attributes_json   TEXT NOT NULL DEFAULT '{}',
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    deleted_at        TEXT
);

CREATE INDEX idx_rel_source ON relationships(source_entity_id);
CREATE INDEX idx_rel_target ON relationships(target_entity_id);
CREATE INDEX idx_rel_deleted ON relationships(deleted_at);

-- Revision history for every entity/relationship mutation. `entity_id` is
-- polymorphic: it holds an entity id or a relationship id, disambiguated by
-- `record_type`.
CREATE TABLE revisions (
    id          TEXT PRIMARY KEY,
    entity_id   TEXT NOT NULL,
    record_type TEXT NOT NULL,
    action      TEXT NOT NULL,
    before_json TEXT,
    after_json  TEXT,
    changed_at  TEXT NOT NULL,
    note        TEXT
);

CREATE INDEX idx_revisions_entity ON revisions(entity_id);

-- Character-specific fields. One row per character entity.
CREATE TABLE character_details (
    entity_id          TEXT PRIMARY KEY REFERENCES entities(id),
    role               TEXT NOT NULL DEFAULT 'supporting',
    status             TEXT NOT NULL DEFAULT 'alive',
    biography          TEXT NOT NULL DEFAULT '',
    appearance         TEXT NOT NULL DEFAULT '',
    goals              TEXT NOT NULL DEFAULT '',
    needs              TEXT NOT NULL DEFAULT '',
    flaws              TEXT NOT NULL DEFAULT '',
    secrets            TEXT NOT NULL DEFAULT '',
    psychology         TEXT NOT NULL DEFAULT '',
    dialogue_style     TEXT NOT NULL DEFAULT '',
    tags_json          TEXT NOT NULL DEFAULT '[]',
    needs_development  INTEGER NOT NULL DEFAULT 0
);
