import { Hono } from "hono";
import { sql } from "@cosimi/adapter-postgres";

/**
 * Read-only corpus inspection for the lab. Loopback-gated.
 *   GET /documents/:id/chunks — a document's chunks (reading order)
 *   GET /chunks/:id/pairs     — a chunk's linked generated pairs (chunk_pair_map)
 */
export const corpusRoute = new Hono();

corpusRoute.get("/documents/:id/chunks", async (c) => {
  const id = c.req.param("id");
  const chunks = await sql()`
    SELECT id, chunk_index, section_title, content, (embedding IS NOT NULL) AS has_embedding
      FROM chunks WHERE document_id = ${id} ORDER BY chunk_index ASC
  `;
  return c.json({ chunks });
});

corpusRoute.get("/chunks/:id/pairs", async (c) => {
  const id = c.req.param("id");
  const pairs = await sql()`
    SELECT p.id::int AS id, p.input, p.response, p.audit_status, (p.embedding IS NOT NULL) AS has_embedding
      FROM pairs p JOIN chunk_pair_map m ON m.pair_id = p.id
     WHERE m.chunk_id = ${id} AND p.deleted_at IS NULL
     ORDER BY p.id ASC
  `;
  return c.json({ pairs });
});
