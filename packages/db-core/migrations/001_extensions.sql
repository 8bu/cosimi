CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- IMMUTABLE wrapper around unaccent so the result can be used in indexes
-- and GENERATED STORED columns. Postgres marks unaccent() as STABLE by
-- default because it reads dictionary files at extension load — STABLE
-- can't appear in expression indexes, but the dictionary is effectively
-- constant per server lifetime, so wrapping it IMMUTABLE is the
-- well-known recipe.
--
-- translate() handles Vietnamese đ/Đ → d/D explicitly as belt-and-
-- suspenders. Modern unaccent dictionaries cover this, but being
-- explicit makes us version-agnostic and self-documenting.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT translate(unaccent('unaccent', $1), 'đĐ', 'dD') $$;
