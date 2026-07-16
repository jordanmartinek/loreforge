-- Phase 4: World Explorer (Locations). Adds the `location` entity type via
-- a new detail table with a self-referential parent/child hierarchy. As
-- with every prior phase, no changes to entities/relationships/revisions --
-- locations link to characters/events via the existing relationships table
-- (relationship_type = 'located_at'), per design-phase-4-locations.md
-- section 1. `parent_location_id` is the one genuinely new structural idea:
-- a strict 1:1 tree edge modeled as a dedicated column rather than a
-- `relationships` row, since `relationships` models N:N associations.

CREATE TABLE location_details (
    entity_id          TEXT PRIMARY KEY REFERENCES entities(id),
    location_type      TEXT NOT NULL DEFAULT 'other',
    description        TEXT NOT NULL DEFAULT '',
    parent_location_id TEXT REFERENCES entities(id)
);

CREATE INDEX idx_location_details_parent ON location_details(parent_location_id);
