-- Runtime configuration: key/value pairs read by the chat handler to fill
-- placeholders in matched responses (e.g. "mình tên {{ name }}" → "mình tên
-- Bé Sim"). Deliberately schemaless — adding a new placeholder is INSERT-only,
-- no migration. Admin UI for editing lands in a later phase; for now operators
-- update rows directly (psql) and reload the api.

CREATE TABLE app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default identity. ON CONFLICT DO NOTHING so re-running the migration on a
-- DB whose operator has already customized the name doesn't stomp the value.
-- Migrations are append-only (CLAUDE.md "Migration discipline") — once on
-- main this row is the seeded baseline, never edited via another migration.
INSERT INTO app_config (key, value) VALUES ('name', 'Bé Sim')
ON CONFLICT (key) DO NOTHING;
