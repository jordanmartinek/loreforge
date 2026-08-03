-- Phase 5: Technology Bible. Adds the `technology` entity type via a new
-- detail table. As with every prior phase, no changes to
-- entities/relationships/revisions -- a technology's dependency graph and
-- its usage links reuse the existing relationships table
-- (relationship_type = 'requires' and 'uses_technology' respectively), per
-- design-phase-5-technology.md section 1. Unlike Phase 4's location
-- hierarchy (a strict tree, modeled as a dedicated parent column), a
-- technology's dependencies are an ordinary N:N graph, which is exactly
-- what `relationships` already models -- no new column needed here.

CREATE TABLE technology_details (
    entity_id       TEXT PRIMARY KEY REFERENCES entities(id),
    category        TEXT NOT NULL DEFAULT 'other',
    description     TEXT NOT NULL DEFAULT '',
    introduced_date TEXT,
    date_precision  TEXT NOT NULL DEFAULT 'day'
);

CREATE INDEX idx_technology_details_category ON technology_details(category);
