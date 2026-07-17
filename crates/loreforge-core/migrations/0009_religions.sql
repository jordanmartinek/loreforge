-- Phase 9: Religions. Adds the `religion` entity type via a new detail
-- table with a self-referential parent/child schism/denomination tree.
-- As with every prior phase, no changes to entities/relationships/
-- revisions -- religions link to characters and locations via the
-- existing relationships table (relationship_type = 'follows' and
-- 'holy_site' respectively), per design-phase-9-religions.md section 2.
-- `parent_religion_id` mirrors Phase 4/6/7's `parent_location_id`/
-- `parent_species_id`/`parent_unit_id`: a schism/denomination tree is a
-- strict single-parent hierarchy, so cycle prevention and
-- reparent-on-delete both use the shared `hierarchy.rs` helper extracted
-- in this same phase (see design-phase-9-religions.md section 1).

CREATE TABLE religion_details (
    entity_id          TEXT PRIMARY KEY REFERENCES entities(id),
    classification     TEXT NOT NULL DEFAULT 'other',
    tenets             TEXT NOT NULL DEFAULT '',
    parent_religion_id TEXT REFERENCES entities(id)
);

CREATE INDEX idx_religion_details_parent ON religion_details(parent_religion_id);
CREATE INDEX idx_religion_details_classification ON religion_details(classification);
