-- Extend unanswered.source to accept 'retrieve' (GraphRAG fallback seam, SP2).
-- Postgres doesn't support ALTER TABLE … ALTER CONSTRAINT, so we drop and
-- recreate the constraint. Existing rows all have 'chat' or 'llm', so the new
-- CHECK still covers them.
ALTER TABLE unanswered DROP CONSTRAINT IF EXISTS unanswered_source_check;
ALTER TABLE unanswered ADD CONSTRAINT unanswered_source_check
  CHECK (source IN ('chat', 'llm', 'retrieve'));
