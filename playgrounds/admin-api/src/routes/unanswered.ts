import { Hono } from "hono";
import * as v from "valibot";

import { sql } from "@cosimi/adapter-postgres";
import type { AdminUnanswered } from "@cosimi/core";

import { PaginationSchema } from "../lib/pagination";

const QuerySchema = v.object({
  ...PaginationSchema.entries,
  source: v.optional(v.picklist(["chat", "llm", "retrieve", "all"] as const), "all"),
});

/**
 * Top-unanswered listing. `source=all` skips the WHERE filter; otherwise we
 * gate by the source column. Ordering by `count DESC, last_seen DESC` is
 * served by `unanswered_count_idx` / `unanswered_source_idx`.
 *
 * BIGSERIAL ids round-trip as strings by default in postgres.js, so we
 * cast `id::int AS id` to keep the wire shape numeric (matches
 * AdminUnanswered.id: number).
 */
export const unansweredRoute = new Hono();

unansweredRoute.get("/", async (c) => {
  const parsed = v.safeParse(QuerySchema, c.req.query());
  if (!parsed.success) return c.json({ error: "invalid query" }, 400);
  const q = parsed.output;

  const rows =
    q.source === "all"
      ? await sql()<AdminUnanswered[]>`
          SELECT id::int AS id, input, normalized_input, source, count, last_seen
            FROM unanswered
           ORDER BY count DESC, last_seen DESC
           LIMIT ${q.limit} OFFSET ${q.offset}
        `
      : await sql()<AdminUnanswered[]>`
          SELECT id::int AS id, input, normalized_input, source, count, last_seen
            FROM unanswered
           WHERE source = ${q.source}
           ORDER BY count DESC, last_seen DESC
           LIMIT ${q.limit} OFFSET ${q.offset}
        `;
  return c.json({ items: rows, limit: q.limit, offset: q.offset });
});
