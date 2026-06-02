import { Hono } from "hono";
import * as v from "valibot";

import { sql } from "@cosimi/adapter-postgres";

/**
 * Bulk soft-delete by source / topic / batch_id. At least one filter must
 * be supplied — an empty body would soft-delete every active pair and is
 * almost certainly a mistake, so we 400 it.
 *
 * Re-running with the same body is a no-op (the `deleted_at IS NULL` guard
 * means already-deleted rows aren't touched and `affected` returns 0).
 * This is the rollback discipline the import_batches table was designed
 * for: each seed run creates a batch row whose id is the rollback unit.
 */
const RollbackSchema = v.pipe(
  v.object({
    source: v.optional(v.picklist(["seed", "user", "chat", "llm"] as const)),
    topic: v.optional(v.string()),
    batch_id: v.optional(v.pipe(v.number(), v.integer())),
  }),
  v.check(
    (b) => b.source !== undefined || b.topic !== undefined || b.batch_id !== undefined,
    "at least one of source/topic/batch_id required",
  ),
);

export const rollbackRoute = new Hono();

rollbackRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = v.safeParse(RollbackSchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const b = parsed.output;

  const db = sql();
  // Conditional fragments — postgres.js inlines empty `sql\`\`` cleanly,
  // so the WHERE clause stays composable without string concat.
  const sourceClause = b.source !== undefined ? db`AND source = ${b.source}` : db``;
  const topicClause = b.topic !== undefined ? db`AND topic = ${b.topic}` : db``;
  const batchClause = b.batch_id !== undefined ? db`AND batch_id = ${b.batch_id}` : db``;

  const r = await db`
    UPDATE pairs SET deleted_at = NOW(), updated_at = NOW()
     WHERE deleted_at IS NULL
       ${sourceClause}
       ${topicClause}
       ${batchClause}
  `;
  return c.json({ affected: r.count });
});
