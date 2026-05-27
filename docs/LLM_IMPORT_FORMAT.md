# LLM Bulk Import — Format & Prompt Guide

Doc describes file format **simlm** server accepts for bulk-import of input/response pairs from external LLM. Format also valid for hand-curated batches — LLM angle scale easy.

Imported rows tagged `source = 'llm'`, grouped under `import_batches` row so whole import rollback in one call.

Import endpoint on **admin API** — separate process bound `127.0.0.1:3001` default (no `/admin/*` prefix — whole process is admin surface). URLs target `http://127.0.0.1:3001`. If reconfigured `ADMIN_HOST` / `ADMIN_PORT`, substitute.

---

## Format

**File type:** JSONL (newline-delimited JSON). Each line one pair. Empty lines ignored.

**Line shape:**

```json
{ "input": "<string>", "response": "<string>", "topic": "<optional string>" }
```

**Field rules:**

| Field      | Required | Type     | Constraints                                     |
| ---------- | -------- | -------- | ----------------------------------------------- |
| `input`    | yes      | string   | non-empty, ≤ 2000 chars                         |
| `response` | yes      | string   | non-empty, ≤ 2000 chars                         |
| `topic`    | no       | string   | optional; if omitted, falls back to URL `?topic=` query param at import time |

**Server-side processing:**

1. Server normalizes `input` (NFC + lowercase + whitespace collapse) into `normalized_input`.
2. Postgres derives `normalized_unaccented` (matching key) via stored generated column.
3. Row inserted with `source = 'llm'` and `batch_id` set to new `import_batches.id`.
4. Duplicates **allowed** — server no dedupe. Multiple `response` values for same `input` is intended pattern for response variety.

---

## Example file (`example.jsonl`)

```jsonl
{"input": "hello", "response": "hi there!"}
{"input": "hello", "response": "hey, what's up?"}
{"input": "how are you?", "response": "i'm doing well, thanks for asking!", "topic": "smalltalk"}
{"input": "tell me a joke", "response": "why did the chicken cross the road? to get to the other side."}
{"input": "good morning", "response": "good morning! ☀️"}
```

---

## Prompt template for an external LLM

Copy into ChatGPT / Claude / Gemini / etc. Fill bracketed placeholders.

> **System:** You are a corpus generator for a SimSimi-style chatbot.
> Your job is to produce `[N]` input/response pairs in JSONL format,
> one pair per line. Each line is valid JSON with the shape:
>
> `{"input": "...", "response": "...", "topic": "..."}`
>
> Constraints:
>
> - Language: `[LANGUAGE]`. Both `input` and `response` MUST be in this language.
> - Topic: `[TOPIC]` (also use this exact string for the `topic` field).
> - Style: casual, friendly, brief — like a chatbot reply, not an essay.
> - `response` MUST be ≤ 200 characters.
> - `input` MUST be ≤ 200 characters.
> - Do NOT repeat exact input/response pairs.
> - You MAY repeat an `input` if the `response` is meaningfully different — this gives the bot reply variety.
> - Output ONLY JSONL. No markdown fences, no commentary, no blank lines, no leading or trailing text.
> - Every line must parse as valid JSON. Use double quotes only.
>
> **User:** Generate `[N]` pairs for the topic above.

### Suggested values for first batches

| Language       | Topic        | Count | Notes                                |
| -------------- | ------------ | ----- | ------------------------------------ |
| Vietnamese     | `greetings`  | 50    | greetings, goodbyes, status checks   |
| Vietnamese     | `smalltalk`  | 100   | weather, mood, daily life            |
| English        | `humor`      | 100   | one-liner jokes, puns                |
| English        | `compliments`| 50    | friendly affirmations                |

Small batches (50–200) easier spot-check and rollback if quality drops.

---

## Importing

```bash
curl -X POST "http://127.0.0.1:3001/import?source=llm&topic=greetings" \
  -H "content-type: application/x-ndjson" \
  --data-binary @example.jsonl
```

Response:

```json
{ "batch_id": 42, "count": 5 }
```

Note `batch_id` — need for rollback.

### Alternative: JSON array body

```bash
curl -X POST "http://127.0.0.1:3001/import?source=llm&topic=greetings" \
  -H "content-type: application/json" \
  -d '[{"input":"hello","response":"hi"},{"input":"bye","response":"see ya"}]'
```

For files over few thousand rows, prefer JSONL — server streams without buffering whole payload.

---

## Rollback

After spot-checking imported pairs (chat with bot, browse `/pairs?batch_id=42`), if anything off, roll whole batch back:

```bash
curl -X POST http://127.0.0.1:3001/rollback \
  -H "content-type: application/json" \
  -d '{"batch_id": 42}'
```

Response:

```json
{ "affected": 5 }
```

Soft-deletes (sets `deleted_at`) every pair in batch. Rows stay in DB for audit; restore individually via `POST /pairs/:id/restore` if change mind.

Can also rollback by topic or source:

```bash
# Everything tagged as topic=humor from any import
curl -X POST http://127.0.0.1:3001/rollback -d '{"topic":"humor"}'

# Every LLM import ever (nuclear option — use carefully)
curl -X POST http://127.0.0.1:3001/rollback -d '{"source":"llm"}'
```

At least one of `batch_id`, `topic`, or `source` required.

---

## Tips

- **Small batches.** 100–200 rows good unit. Easy review, easy rollback.
- **Topic discipline.** Always set `?topic=`. Without topic, rollback granularity drops to source-wide.
- **Language consistency.** Mixing languages in single batch makes review harder. One language per batch.
- **Spot-check.** Before importing 1000 rows, generate 20, import, chat with bot. If sounds off, refine prompt and retry.
- **Duplicates OK.** Matcher randomly picks within top-K, so three different `response`s for `"hello"` gives natural variety.
- **No need hand-tag source.** Server tags every row in this import as `source='llm'` based on query param — file just contains `input`/`response`/`topic`.