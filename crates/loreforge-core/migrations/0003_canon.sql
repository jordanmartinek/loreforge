-- Phase 3: Canon Management. Adds the `canon` entity type via a new detail
-- table. As with events (Phase 2), no changes to entities/relationships/
-- revisions -- canon entries reuse the existing relationships table for
-- dependencies (relationship_type = 'depends_on') and links to other
-- entities (relationship_type = 'relates_to'), per
-- design-phase-3-canon.md section 1.

CREATE TABLE canon_details (
    entity_id   TEXT PRIMARY KEY REFERENCES entities(id),
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft',
    version     INTEGER NOT NULL DEFAULT 1,
    notes       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_canon_details_status ON canon_details(status);
