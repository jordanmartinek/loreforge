-- Phase 10: Organizations. Adds the `organization` entity type via a new
-- detail table with a self-referential parent/child subsidiary tree
-- (the fifth entity type to use this shape, after Locations/Species/
-- Military/Religions). Organizations link to characters and locations
-- via the existing relationships table (relationship_type =
-- 'affiliated_with' and 'operates_at'), and to each other via the second
-- pair of symmetric relationship types this app has ('org_allied_with'
-- and 'org_rival_of', validated by the shared symmetric.rs module
-- extracted this same phase) -- per design-phase-10-organizations.md
-- sections 1 and 2.

CREATE TABLE organization_details (
    entity_id              TEXT PRIMARY KEY REFERENCES entities(id),
    classification         TEXT NOT NULL DEFAULT 'other',
    charter                TEXT NOT NULL DEFAULT '',
    parent_organization_id TEXT REFERENCES entities(id)
);

CREATE INDEX idx_organization_details_parent ON organization_details(parent_organization_id);
CREATE INDEX idx_organization_details_classification ON organization_details(classification);
