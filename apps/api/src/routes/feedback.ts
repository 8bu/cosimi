import { Hono } from "hono";
import * as v from "valibot";

import { sql } from "@cosimi/db";
import { loadEnv } from "@cosimi/core";
import type { FeedbackResponse } from "@cosimi/core";

import { withSession } from "../lib/session";

const FeedbackBodySchema = v.object({
  pair_id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  value: v.union([v.literal(1), v.literal(-1)]),
  session_id: v.optional(v.pipe(v.string(), v.uuid())),
});

export const feedbackRoute = new Hono();

feedbackRoute.post("/", withSession, async (c) => {
  const parsed = v.safeParse(FeedbackBodySchema, c.get("parsedBody"));
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  const env = loadEnv();
  const sessionId = c.get("sessionId");
  const { pair_id, value } = parsed.output;

  try {
    const result = await sql().begin(async (tx) => {
      // votes UNIQUE(session_id, pair_id) flips the value on conflict so
      // a thumbs-up → thumbs-down change-of-mind is a single row, not two.
      await tx`
        INSERT INTO votes (session_id, pair_id, value)
        VALUES (${sessionId}::uuid, ${pair_id}, ${value})
        ON CONFLICT (session_id, pair_id) DO UPDATE SET
          value      = EXCLUDED.value,
          updated_at = NOW()
      `;

      // Row lock serializes concurrent voters on the same pair so the
      // recomputed score never lags behind concurrent inserts.
      const pairRows = await tx<{ id: number; deleted_at: Date | null }[]>`
        SELECT id, deleted_at FROM pairs WHERE id = ${pair_id} FOR UPDATE
      `;
      const pair = pairRows[0];
      if (!pair) return null;

      // Authoritative recompute — never trust an incremental delta.
      const agg = await tx<{ net: number }[]>`
        SELECT COALESCE(SUM(value), 0)::int AS net FROM votes WHERE pair_id = ${pair_id}
      `;
      const new_score = agg[0]!.net;

      const should_prune = new_score <= env.PRUNE_SCORE_THRESHOLD && pair.deleted_at === null;

      if (should_prune) {
        await tx`
          UPDATE pairs
             SET score = ${new_score}, deleted_at = NOW(), updated_at = NOW()
           WHERE id = ${pair_id}
        `;
      } else {
        await tx`
          UPDATE pairs
             SET score = ${new_score}, updated_at = NOW()
           WHERE id = ${pair_id}
        `;
      }

      return { new_score, was_pruned: should_prune };
    });

    if (!result) return c.json({ error: "pair not found" }, 404);
    const payload: FeedbackResponse = { pair_id, ...result };
    return c.json(payload);
  } catch (err) {
    // FK violation (pair deleted between SELECT and INSERT) — treat as 404
    if (err && typeof err === "object" && "code" in err && err.code === "23503") {
      return c.json({ error: "pair not found" }, 404);
    }
    throw err;
  }
});
