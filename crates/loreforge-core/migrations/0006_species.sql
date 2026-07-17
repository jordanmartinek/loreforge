-- Phase 6: Species Codex. Adds the `species` entity type via a new detail
-- table with a self-referential parent/child taxonomy tree. As with every
-- prior phase, no changes to entities/relationships/revisions -- species
-- link to characters and locations via the existing relationships table
-- (relationship_type = 'member_of' and 'native_to' respectively), per
-- design-phase-6-species.md section 1. `parent_species_id` mirrors Phase
-- 4's `parent_location_id`: biological taxonomy is a strict tree (a
-- subspecies has exactly one parent taxon), structurally unlike Phase 5's
-- technology dependency graph, so it's a dedicated column, not a
-- `relationships` row.

CREATE TABLE species_details (
    entity_id         TEXT PRIMARY KEY REFERENCES entities(id),
    classification    TEXT NOT NULL DEFAULT 'other',
    biology           TEXT NOT NULL DEFAULT '',
    parent_species_id TEXT REFERENCES entities(id)
);

CREATE INDEX idx_species_details_parent ON species_details(parent_species_id);
CREATE INDEX idx_species_details_classification ON species_details(classification);
