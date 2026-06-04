import { Hono } from "hono";
import * as v from "valibot";
import { sql } from "@cosimi/adapter-postgres";

const UuidSchema = v.pipe(v.string(), v.uuid());

interface DocumentRow {
  id: string;
  title: string;
  mime_type: string;
  created_at: string;
  chunkCount: number;
  pairCount: number;
}

/**
 * List ingested documents (newest first) with per-document chunk + pair counts
 * for the lab's Documents table. Read-only; loopback-gated. Counts via
 * correlated subqueries — fine at lab scale.
 */
export const documentsRoute = new Hono();

documentsRoute.get("/", async (c) => {
  const documents = await sql()<DocumentRow[]>`
    SELECT
      d.id, d.title, d.mime_type, d.created_at,
      (SELECT count(*)::int FROM chunks ch WHERE ch.document_id = d.id) AS "chunkCount",
      (SELECT count(*)::int FROM chunks ch
         JOIN chunk_pair_map m ON m.chunk_id = ch.id
        WHERE ch.document_id = d.id) AS "pairCount"
    FROM documents d
    ORDER BY d.created_at DESC
  `;
  return c.json({ documents });
});

/**
 * Purge a document and everything derived from it (corpus cleanup).
 *
 * The FK graph cascades document → chunks → {chunk_relations, chunk_pair_map},
 * but generated `pairs` only get `source_chunk → SET NULL` — they'd survive as
 * orphaned retrieval targets. So we hard-delete those pairs first, inside the
 * same transaction. Pairs are 1:1-owned by their generating chunk (ingest calls
 * mapChunkToPair once per chunk), so no pair is shared across documents.
 * Idempotent: a missing id → 404, never a partial delete.
 */
documentsRoute.delete("/:id", async (c) => {
  const parsed = v.safeParse(UuidSchema, c.req.param("id"));
  if (!parsed.success) return c.json({ error: "invalid document id" }, 400);
  const id = parsed.output;

  const db = sql();
  const result = await db.begin(async (tx) => {
    const doc = await tx`SELECT id FROM documents WHERE id = ${id}`;
    if (doc.length === 0) return null;
    const pairRows = await tx<{ id: number }[]>`
      SELECT DISTINCT m.pair_id::int AS id
        FROM chunk_pair_map m
        JOIN chunks ch ON ch.id = m.chunk_id
       WHERE ch.document_id = ${id}
    `;
    const pairIds = pairRows.map((r) => r.id);
    if (pairIds.length > 0) await tx`DELETE FROM pairs WHERE id = ANY(${pairIds})`;
    await tx`DELETE FROM documents WHERE id = ${id}`;
    return { deletedPairs: pairIds.length };
  });

  if (result === null) return c.json({ error: "document not found" }, 404);
  return c.json({ ok: true, ...result });
});
