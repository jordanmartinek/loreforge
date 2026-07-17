-- Phase 7: Military. Adds the `military_unit` entity type via a new detail
-- table with a self-referential parent/child chain-of-command tree. As
-- with every prior phase, no changes to entities/relationships/revisions
-- -- military units link to characters, locations, and technology via the
-- existing relationships table (relationship_type = 'serves_in',
-- 'stationed_at', and 'equipped_with' respectively), per
-- design-phase-7-military.md section 1. `parent_unit_id` mirrors Phase
-- 4's `parent_location_id` and Phase 6's `parent_species_id`: a chain of
-- command is a strict tree (a unit reports to exactly one parent unit),
-- structurally unlike Phase 5's technology dependency graph, so it's a
-- dedicated column, not a `relationships` row.

CREATE TABLE military_unit_details (
    entity_id      TEXT PRIMARY KEY REFERENCES entities(id),
    branch         TEXT NOT NULL DEFAULT 'other',
    doctrine       TEXT NOT NULL DEFAULT '',
    parent_unit_id TEXT REFERENCES entities(id)
);

CREATE INDEX idx_military_unit_details_parent ON military_unit_details(parent_unit_id);
CREATE INDEX idx_military_unit_details_branch ON military_unit_details(branch);
