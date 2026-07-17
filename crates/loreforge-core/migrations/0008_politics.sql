-- Phase 8: Politics. Adds the `political_entity` entity type via a new
-- detail table. Unlike Phases 4/6/7, this entity type has no
-- self-referential parent column -- a political entity is not modeled as
-- containing other political entities (see design-phase-8-politics.md
-- section 1.2). Political entities link to characters and locations via
-- the existing relationships table (relationship_type = 'leads' and
-- 'controls'), and to each other via the app's first symmetric
-- relationship types ('allied_with' and 'rival_of'), enforced at the
-- application layer in politics.rs -- no schema change needed for
-- symmetry itself.

CREATE TABLE political_entity_details (
    entity_id      TEXT PRIMARY KEY REFERENCES entities(id),
    classification TEXT NOT NULL DEFAULT 'other',
    ideology       TEXT NOT NULL DEFAULT '',
    founded_date   TEXT,
    date_precision TEXT NOT NULL DEFAULT 'day'
);

CREATE INDEX idx_political_entity_details_classification
    ON political_entity_details(classification);
