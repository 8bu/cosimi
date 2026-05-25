import { Hono } from "hono";
import * as v from "valibot";

import { insertPair, sql } from "@simlm/db";
import type { AdminTeachQueueItem } from "@simlm/types";

import { PaginationSchema } from "../lib/pagination";

const ListQuerySchema = v.object({
  ...PaginationSchema.entries,
  status: v.optional(v.picklist(["pending", "approved", "rejected"] as const)),
  flagged: v.optional(
    v.pipe(
      v.string(),
      v.transform((s) => s === "true" || s === "1"),
    ),
  ),
});

const IdSchema = v.pipe(v.string(), v.decimal(), v.transform(Number), v.integer(), v.minValue(1));

const RejectBodySchema = v.object({
  reviewer_note: v.optional(v.string()),
});

const BatchSchema = v.object({
  ids: v.pipe(
    v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
    v.minLength(1),
    v.maxLength(500),
  ),
  action: v.picklist(["approve", "reject"] as const),
  reviewer_note: v.optional(v.string()),
});

interface QueueRowInternal {
  id: number;
  input: string;
  normalized_input: string;
  response: string;
  topic: string | null;
  flagged: boolean;
  locale: string;
}

export const teachQueueRoute = new Hono();

teachQueueRoute.get("/", async (c) => {
  const parsed = v.safeParse(ListQuerySchema, c.req.query());
  if (!parsed.success) return c.json({ error: "invalid query" }, 400);
  const q = parsed.output;

  const db = sql();
  const statusClause = q.status !== undefined ? db`AND status = ${q.status}` : db``;
  const flaggedClause = q.flagged !== undefined ? db`AND flagged = ${q.flagged}` : db``;

  const rows = await db<AdminTeachQueueItem[]>`
    SELECT id::int AS id, input, response, topic, submitted_by_session::text AS submitted_by_session,
           status, flagged, flag_reason, created_at
      FROM teach_queue
     WHERE TRUE
       ${statusClause}
       ${flaggedClause}
     ORDER BY created_at DESC
     LIMIT ${q.limit} OFFSET ${q.offset}
  `;
  return c.json({ items: rows, limit: q.limit, offset: q.offset });
});

/**
 * Promote a single pending teach into `pairs`. Uses `FOR UPDATE` to
 * serialize against concurrent approvers and the canonical `insertPair`
 * write path (no raw INSERT INTO pairs — CLAUDE.md rule). The queue UPDATE
 * sets `pair_id` for traceability and clears `status` to 'approved' in
 * the same transaction, so either both writes land or neither does.
 */
teachQueueRoute.post("/:id/approve", async (c) => {
  const idParsed = v.safeParse(IdSchema, c.req.param("id"));
  if (!idParsed.success) return c.json({ error: "invalid id" }, 400);
  const id = idParsed.output;

  const db = sql();
  const result = await db.begin(async (tx) => {
    const rows = await tx<QueueRowInternal[]>`
      SELECT id::int AS id, input, normalized_input, response, topic, flagged, locale
        FROM teach_queue
       WHERE id = ${id} AND status = 'pending'
       FOR UPDATE
    `;
    const queueRow = rows[0];
    if (!queueRow) return null;

    const { id: pairId } = await insertPair(
      {
        input: queueRow.input,
        response: queueRow.response,
        source: "chat",
        topic: queueRow.topic,
        flagged: queueRow.flagged,
        locale: queueRow.locale,
      },
      tx,
    );

    await tx`
      UPDATE teach_queue
         SET status = 'approved', reviewed_at = NOW(), pair_id = ${pairId}
       WHERE id = ${id}
    `;
    return { pair_id: pairId };
  });

  if (!result) return c.json({ error: "not found or not pending" }, 404);
  return c.json(result);
});

teachQueueRoute.post("/:id/reject", async (c) => {
  const idParsed = v.safeParse(IdSchema, c.req.param("id"));
  if (!idParsed.success) return c.json({ error: "invalid id" }, 400);
  const id = idParsed.output;

  const body = await c.req.json().catch(() => ({}));
  const parsed = v.safeParse(RejectBodySchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  const r = await sql()`
    UPDATE teach_queue
       SET status = 'rejected', reviewed_at = NOW(), reviewer_note = ${parsed.output.reviewer_note ?? null}
     WHERE id = ${id} AND status = 'pending'
  `;
  if (r.count === 0) return c.json({ error: "not found or not pending" }, 404);
  return c.json({ ok: true });
});

/**
 * Bulk approve/reject. Reject is a single UPDATE … WHERE id = ANY(ids).
 * Approve loops inside one transaction so each pair insert maps cleanly
 * to its source queue row and the whole batch is atomic (acceptance
 * criterion: "bulk approve of 50 IDs is atomic — either all 50 land or
 * none"). The 500-id cap keeps it bounded.
 */
teachQueueRoute.post("/batch", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = v.safeParse(BatchSchema, body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const b = parsed.output;

  if (b.action === "reject") {
    const r = await sql()`
      UPDATE teach_queue
         SET status = 'rejected', reviewed_at = NOW(), reviewer_note = ${b.reviewer_note ?? null}
       WHERE id = ANY(${b.ids}) AND status = 'pending'
    `;
    return c.json({ rejected: r.count });
  }

  const db = sql();
  const result = await db.begin(async (tx) => {
    const queued = await tx<QueueRowInternal[]>`
      SELECT id::int AS id, input, normalized_input, response, topic, flagged, locale
        FROM teach_queue
       WHERE id = ANY(${b.ids}) AND status = 'pending'
       FOR UPDATE
    `;
    let approved = 0;
    for (const q of queued) {
      const { id: pairId } = await insertPair(
        {
          input: q.input,
          response: q.response,
          source: "chat",
          topic: q.topic,
          flagged: q.flagged,
          locale: q.locale,
        },
        tx,
      );
      await tx`
        UPDATE teach_queue
           SET status = 'approved', reviewed_at = NOW(), pair_id = ${pairId}
         WHERE id = ${q.id}
      `;
      approved++;
    }
    return { approved };
  });
  return c.json(result);
});
