import { Hono } from "hono";
import * as v from "valibot";

import { insertPair, sql } from "@cosimi/adapter-postgres";
import { normalize } from "@cosimi/normalizer";
import type { AdminPair } from "@cosimi/core";

import { PaginationSchema } from "../lib/pagination";

const CreateSchema = v.object({
  input: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000)),
  response: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000)),
  topic: v.optional(v.string()),
  source: v.optional(v.picklist(["user", "seed", "llm"] as const), "user"),
  flagged: v.optional(v.boolean(), false),
});

const EditSchema = v.object({
  input: v.optional(v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000))),
  response: v.optional(v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000))),
  topic: v.optional(v.string()),
  source: v.optional(v.picklist(["user", "seed", "llm", "chat"] as const)),
  flagged: v.optional(v.boolean()),
});

const ListQuerySchema = v.object({
  ...PaginationSchema.entries,
  source: v.optional(v.picklist(["seed", "user", "chat", "llm"] as const)),
  topic: v.optional(v.string()),
  q: v.optional(v.string()),
  // batch_id is wired as a navigation target from /import's success card;
  // the Pairs UI doesn't surface a manual input for it (PairsFilters
  // stays focused on the day-to-day filters). URL-driven only.
  batch_id: v.optional(v.pipe(v.string(), v.decimal(), v.transform(Number), v.integer())),
  include_deleted: v.optional(
    v.pipe(
      v.string(),
      v.transform((s) => s === "true" || s === "1"),
    ),
    "false",
  ),
});

const IdSchema = v.pipe(v.string(), v.decimal(), v.transform(Number), v.integer(), v.minValue(1));

export const pairsRoute = new Hono();

pairsRoute.get("/", async (c) => {
  const parsed = v.safeParse(ListQuerySchema, c.req.query());
  if (!parsed.success) return c.json({ error: "invalid query" }, 400);
  const q = parsed.output;

  const db = sql();
  const deletedClause = q.include_deleted ? db`TRUE` : db`deleted_at IS NULL`;
  const sourceClause = q.source !== undefined ? db`AND source = ${q.source}` : db``;
  const topicClause = q.topic !== undefined ? db`AND topic = ${q.topic}` : db``;
  const batchClause = q.batch_id !== undefined ? db`AND batch_id = ${q.batch_id}` : db``;
  // `q` filters on normalized_unaccented via ILIKE so callers can fuzzy-grep
  // the corpus. Wrapping with f_unaccent on both sides keeps the comparison
  // symmetric with the matcher's write/read pipeline.
  const searchClause =
    q.q !== undefined && q.q.length > 0
      ? db`AND normalized_unaccented ILIKE ${"%" + normalize(q.q) + "%"}`
      : db``;

  const rows = await db<AdminPair[]>`
    SELECT id::int AS id, input, normalized_input, response, score,
           source, topic, batch_id::int AS batch_id, flagged,
           deleted_at, created_at, updated_at
      FROM pairs
     WHERE ${deletedClause}
       ${sourceClause}
       ${topicClause}
       ${batchClause}
       ${searchClause}
     ORDER BY id DESC
     LIMIT ${q.limit} OFFSET ${q.offset}
  `;
  return c.json({ items: rows, limit: q.limit, offset: q.offset });
});

pairsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = v.safeParse(CreateSchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  // Canonical write path — insertPair handles normalize() and never lists
  // the generated `normalized_unaccented` column. The companion DELETE
  // self-cleans any `unanswered` rows whose normalized_input matches the
  // freshly-taught pair: both tables normalize via the same `normalize()`
  // function, so equality is the right key. Source filter is omitted
  // intentionally — a single Teach is the canonical answer for both
  // 'chat' and 'llm' duplicates of the same normalized question.
  // Atomic via db.begin: if the unanswered DELETE somehow fails the pair
  // insert rolls back, preserving the "user clicked Teach but no row
  // appeared in pairs" debuggability gap.
  const db = sql();
  const { id } = await db.begin(async (tx) => {
    const inserted = await insertPair(parsed.output, tx);
    await tx`DELETE FROM unanswered WHERE normalized_input = ${normalize(parsed.output.input)}`;
    return inserted;
  });
  return c.json({ id }, 201);
});

pairsRoute.patch("/:id", async (c) => {
  const idParsed = v.safeParse(IdSchema, c.req.param("id"));
  if (!idParsed.success) return c.json({ error: "invalid id" }, 400);
  const id = idParsed.output;

  const body = await c.req.json().catch(() => null);
  const parsed = v.safeParse(EditSchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const b = parsed.output;

  // Build the SET list as conditional sql fragments. `updated_at = NOW()`
  // stays a literal fragment (a postgres.js Fragment as a Record value
  // would be stringified, not interpolated). If `input` changes we
  // re-normalize in JS — the GENERATED column regenerates
  // `normalized_unaccented` server-side.
  const db = sql();
  const setInput = b.input !== undefined ? db`, input = ${b.input}` : db``;
  const setNormalized =
    b.input !== undefined ? db`, normalized_input = ${normalize(b.input)}` : db``;
  const setResponse = b.response !== undefined ? db`, response = ${b.response}` : db``;
  const setTopic = b.topic !== undefined ? db`, topic = ${b.topic}` : db``;
  const setSource = b.source !== undefined ? db`, source = ${b.source}` : db``;
  const setFlagged = b.flagged !== undefined ? db`, flagged = ${b.flagged}` : db``;

  const r = await db`
    UPDATE pairs
       SET updated_at = NOW()
           ${setInput}
           ${setNormalized}
           ${setResponse}
           ${setTopic}
           ${setSource}
           ${setFlagged}
     WHERE id = ${id}
  `;
  if (r.count === 0) return c.json({ error: "pair not found" }, 404);
  return c.json({ ok: true });
});

pairsRoute.delete("/:id", async (c) => {
  const idParsed = v.safeParse(IdSchema, c.req.param("id"));
  if (!idParsed.success) return c.json({ error: "invalid id" }, 400);
  const r = await sql()`
    UPDATE pairs SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = ${idParsed.output} AND deleted_at IS NULL
  `;
  if (r.count === 0) return c.json({ error: "pair not found or already deleted" }, 404);
  return c.json({ ok: true });
});

pairsRoute.post("/:id/restore", async (c) => {
  const idParsed = v.safeParse(IdSchema, c.req.param("id"));
  if (!idParsed.success) return c.json({ error: "invalid id" }, 400);
  const r = await sql()`
    UPDATE pairs SET deleted_at = NULL, updated_at = NOW()
     WHERE id = ${idParsed.output}
  `;
  if (r.count === 0) return c.json({ error: "pair not found" }, 404);
  return c.json({ ok: true });
});
