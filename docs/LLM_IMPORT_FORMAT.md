# LLM Bulk Import — Format & Prompt Guide

This document describes the file format the **simlm** server accepts for bulk-importing input/response pairs generated externally by an LLM. The format is also valid for hand-curated batches — the LLM angle just makes it easy to scale.

Imported rows are tagged `source = 'llm'` and grouped under an `import_batches` row so the whole import can be rolled back in one call.

The import endpoint lives on the **admin API**, which is a separate process bound to `127.0.0.1:3001` by default (no `/admin/*` prefix — the whole process is the admin surface). All URLs in this doc target `http://127.0.0.1:3001`. If you've reconfigured `ADMIN_HOST` / `ADMIN_PORT`, substitute accordingly.

---

## Format

**File type:** JSONL (newline-delimited JSON). Each line is one pair. Empty lines ignored.

**Line shape:**

```json
{ "input": "<string>", "response": "<string>", "topic": "<optional string>" }
```

**Field rules:**

| Field      | Required | Type     | Constraints                                     |
| ---------- | -------- | -------- | ----------------------------------------------- |
| `input`    | yes      | string   | non-empty, ≤ 2000 chars                         |
| `response` | yes      | string   | non-empty, ≤ 2000 chars                         |
| `topic`    | no       | string   | optional; if omitted, falls back to the URL `?topic=` query param at import time |

**Server-side processing:**

1. The server normalizes `input` (NFC + lowercase + whitespace collapse) into `normalized_input`.
2. Postgres derives `normalized_unaccented` (the matching key) via a stored generated column.
3. The row is inserted with `source = 'llm'` and `batch_id` set to the new `import_batches.id`.
4. Duplicates are **allowed** — the server does not dedupe. Multiple `response` values for the same `input` is the intended pattern for response variety.

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

Copy this into ChatGPT / Claude / Gemini / etc. Fill the bracketed placeholders.

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

Smaller batches (50–200) are easier to spot-check and roll back if quality drops.

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

Note the `batch_id` — you'll need it to roll back.

### Alternative: JSON array body

```bash
curl -X POST "http://127.0.0.1:3001/import?source=llm&topic=greetings" \
  -H "content-type: application/json" \
  -d '[{"input":"hello","response":"hi"},{"input":"bye","response":"see ya"}]'
```

For files over a few thousand rows, prefer JSONL — the server streams it without buffering the whole payload.

---

## Rollback

After spot-checking the imported pairs (try chatting with the bot, browse `/pairs?batch_id=42`), if anything looks off, roll the whole batch back:

```bash
curl -X POST http://127.0.0.1:3001/rollback \
  -H "content-type: application/json" \
  -d '{"batch_id": 42}'
```

Response:

```json
{ "affected": 5 }
```

This soft-deletes (sets `deleted_at`) every pair in the batch. The rows stay in the DB for audit; restore individually via `POST /pairs/:id/restore` if you change your mind.

You can also roll back by topic or source:

```bash
# Everything tagged as topic=humor from any import
curl -X POST http://127.0.0.1:3001/rollback -d '{"topic":"humor"}'

# Every LLM import ever (nuclear option — use carefully)
curl -X POST http://127.0.0.1:3001/rollback -d '{"source":"llm"}'
```

At least one of `batch_id`, `topic`, or `source` is required.

---

## Tips

- **Small batches.** 100–200 rows is a good unit. Easy to review, easy to roll back.
- **Topic discipline.** Always set `?topic=`. Without a topic, rollback granularity drops to source-wide.
- **Language consistency.** Mixing languages in a single batch makes review harder. One language per batch.
- **Spot-check.** Before importing 1000 rows, generate 20, import, chat with the bot. If it sounds off, refine the prompt and retry.
- **Duplicates are OK.** The matcher randomly picks within top-K, so having three different `response`s for `"hello"` gives natural variety.
- **No need to hand-tag the source.** The server tags every row in this import as `source='llm'` based on the query param — your file just contains `input`/`response`/`topic`.
