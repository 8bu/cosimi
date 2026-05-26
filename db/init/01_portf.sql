-- Runs once on fresh container volume. Creates the `portf` database
-- alongside the default `simlm` one defined by POSTGRES_DB.
-- For existing volumes, use `pnpm provision:portf` instead.

SELECT 'CREATE DATABASE portf'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'portf')\gexec
