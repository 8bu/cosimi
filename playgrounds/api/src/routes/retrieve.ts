import { Hono } from "hono";
import * as v from "valibot";
import { sql } from "@cosimi/adapter-postgres";
import { createCosimi } from "@cosimi/sdk";

import { resolveEmbedder } from "../lib/embedder";

const LocaleString = v.pipe(v.string(), v.nonEmpty(), v.maxLength(16));

const RetrieveBodySchema = v.object({
  query: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000)),
  topK: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50))),
  seedK: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50))),
  maxHops: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(5))),
  minSimilarity: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  locales: v.optional(v.pipe(v.array(LocaleString), v.maxLength(8))),
});

export const retrieveRoute = new Hono();

/**
 * GraphRAG retrieval. Deterministic, LLM-free: embed the query, seed from the
 * nearest chunks, expand the graph, return ranked chunks with their linked
 * pairs as JSON. No session, no SSE. On an empty result (no seed cleared the
 * similarity floor) we upsert the query into `unanswered` (source='retrieve')
 * — the seed for the future fallback-curation UI (spec P2-D6).
 */
retrieveRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = v.safeParse(RetrieveBodySchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  const { query, ...opts } = parsed.output;
  const cosimi = createCosimi({ sql, embedder: resolveEmbedder() });
  const result = await cosimi.retrieve(query, opts);

  if (result.hits.length === 0) {
    await sql()`
      INSERT INTO unanswered (input, normalized_input, source, count, last_seen)
      VALUES (${query}, ${query}, 'retrieve', 1, NOW())
      ON CONFLICT (normalized_input) DO UPDATE SET
        count     = unanswered.count + 1,
        last_seen = NOW()
    `;
  }

  return c.json(result);
});
