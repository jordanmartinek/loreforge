-- Phase 2: Timeline System. Adds the `event` entity type via a new detail
-- table. No changes to entities/relationships/revisions -- events reuse the
-- existing relationships table (relationship_type = 'participates_in') to
-- link to characters, per design-phase-2-timeline.md section 1.

CREATE TABLE event_details (
    entity_id      TEXT PRIMARY KEY REFERENCES entities(id),
    description    TEXT NOT NULL DEFAULT '',
    layers_json    TEXT NOT NULL DEFAULT '[]',
    start_date     TEXT NOT NULL,
    end_date       TEXT,
    date_precision TEXT NOT NULL DEFAULT 'day',
    significance   TEXT NOT NULL DEFAULT 'minor'
);

CREATE INDEX idx_event_details_start ON event_details(start_date);
