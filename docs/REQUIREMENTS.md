# SimSimi-style Chatbot — Requirements

## Stack
- Backend: Hono.js + TypeScript
- DB: Postgres (production) / PGLite (dev option)
- Driver: `postgres` (porsager)
- No LLM, no external AI APIs at runtime

## Core features

**Pattern matching engine**
- Exact match (normalized)
- Postgres full-text search fallback
- Trigram similarity fallback (`pg_trgm`)
- Configurable confidence thresholds per tier
- Return random pick from top-K matches for variety
- Vietnamese + English support (NFC normalization, unicode-aware)

**Learning system**
- Seed data import from JSON/YAML
- Online teaching: user submits input/response pairs
- Multiple responses per input (no dedup on insert)
- Feedback: upvote/downvote, auto-prune below threshold
- Log unanswered inputs with frequency for admin review
- **LLM-generated bulk import**: ingest large JSON/JSONL files of input/response pairs generated externally by an LLM. Format spec must be documented so the LLM can produce drop-in files. Tag imported rows with `source='llm'` and optional `topic` field for filtering/rollback.
- **Inline `/teach` command**: during a chat session, if the bot returns no match or a low-confidence match, the user can issue `/teach <expected reply>` (or `/teach "input" => "reply"`) to attach the expected response to the previous input. Server must:
  - Track last user input per session/conversation ID
  - Parse `/teach` syntax (with and without explicit input override)
  - Insert new pair tagged `source='chat'`
  - Confirm back to user via the same SSE stream
  - Reject empty/abusive payloads, rate-limit per session

**Streaming API**
- SSE endpoint mimicking OpenAI/Anthropic chat stream format
- Configurable fake typing delay (jittered, per-char or per-token)
- Token-by-token chunked emission
- Session/conversation ID support (needed for `/teach` context)

**Admin**
- Review high-frequency unanswered inputs
- Add/edit/delete pairs
- Bulk import endpoint (supports `seed`, `user`, `chat`, `llm` sources)
- Rollback by source/topic/import batch
- Basic auth or token-protected

## Database schema
- `pairs` table: input, normalized input, response, score, source, topic, batch_id, timestamps
- `unanswered` table: input, count, last_seen
- `import_batches` table: id, source, topic, count, created_at (for rollback)
- `sessions` table (or in-memory cache): session_id, last_input, last_input_id, updated_at
- GIN indexes for FTS and trigram

## Non-functional
- Zero external API calls at runtime
- Stateless server for chat logic (state lives in Postgres)
- Docker-ready
- Seed + migration scripts
- ENV-based config

## Deliverables
- Project scaffold with folder structure
- Migration SQL
- Hono routes: `/chat` (SSE), `/teach`, `/feedback`, `/admin/*`, `/admin/import`
- Normalization utility (Vietnamese-safe)
- `/teach` command parser + session tracker
- Seed import script
- LLM import spec doc: schema + example prompt template
- README with setup + curl examples (including `/teach` flow demo)

## Out of scope
- No embeddings, no ML training
- No auth system beyond admin token
- No frontend (API only)
- No runtime LLM calls
