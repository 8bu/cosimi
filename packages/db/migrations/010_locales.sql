-- Phase 11.1: per-row locale tagging for pairs, session_teaches, teach_queue.
--
-- Default 'und' (ISO 639-3 BCP-47 "undetermined") so existing rows keep
-- matching under any primary locale as a low-priority fallback — no data
-- backfill heuristic. Operators who want sharper tagging on a fresh seed
-- run `pnpm seed:vi --locale=vi` (and equivalent for the chatterbot snapshot
-- with --locale=en).
--
-- TEXT (not CHAR(N) or enum) is deliberate: adding a third locale later
-- (ja, zh-Hant, …) is a UI <select> option + a fallback_message_<x> row,
-- never a schema migration.

ALTER TABLE pairs            ADD COLUMN locale TEXT NOT NULL DEFAULT 'und';
ALTER TABLE session_teaches  ADD COLUMN locale TEXT NOT NULL DEFAULT 'und';
ALTER TABLE teach_queue      ADD COLUMN locale TEXT NOT NULL DEFAULT 'und';

-- Partial index mirrors the existing matcher index pattern. The matcher's
-- per-locale WHERE adds `AND (locale = $1 OR locale = 'und')`, so a small
-- index on `locale` (filtered to live rows) lets the optimizer skip
-- soft-deletes without paying for them in the index size.
CREATE INDEX pairs_locale_idx ON pairs (locale) WHERE deleted_at IS NULL;

-- Per-locale no-match fallback messages. The chat handler picks
-- `app_config[fallback_message_${primaryLocale}]` → `fallback_message_und`
-- → env.FALLBACK_MESSAGE (last-resort if rows were wiped). All three pass
-- through renderTemplate, so {{ name }} substitution keeps working in the
-- localized strings.
INSERT INTO app_config (key, value) VALUES
  ('fallback_message_und', 'hmm idk, tell me more?'),
  ('fallback_message_vi',  'hmm chưa biết, kể mình nghe thêm đi?'),
  ('fallback_message_en',  'hmm idk, tell me more?')
ON CONFLICT (key) DO NOTHING;
