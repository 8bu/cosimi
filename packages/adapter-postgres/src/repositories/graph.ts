import type postgres from "postgres";
import type { Chunk, RelationType } from "@cosimi/db-core";
import { sql } from "#client";
import { fromVector } from "../vector";

// NOTE: the GraphRepository port's `addNode(chunk)` is intentionally NOT
// implemented here. Against this SQL backing a chunk IS its node — it already
// lives in the `chunks` table — so the pipeline creates nodes via `createChunk`.
// This adapter only manages edges (`chunk_relations`) and traversal.

type Executor = postgres.Sql | postgres.TransactionSql;

// M1: Row/map are duplicated from chunks.ts (a chunk row). Extract to a shared
// module when a third call site appears — not before.
interface Row {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  section_title: string | null;
  embedding: string | null;
  created_at: Date;
}

const map = (r: Row): Chunk => ({
  id: r.id,
  documentId: r.document_id,
  content: r.content,
  chunkIndex: r.chunk_index,
  sectionTitle: r.section_title,
  embedding: fromVector(r.embedding),
  createdAt: r.created_at,
});

export async function addEdge(
  fromId: string,
  toId: string,
  type: RelationType,
  tx?: Executor,
): Promise<void> {
  const db = tx ?? sql();
  await db`
    INSERT INTO chunk_relations (from_chunk_id, to_chunk_id, relation_type)
    VALUES (${fromId}, ${toId}, ${type})
    ON CONFLICT DO NOTHING
  `;
}

export async function getParent(chunkId: string): Promise<Chunk | null> {
  // The pipeline links each child to exactly one PARENT_OF parent, so `LIMIT 1`
  // is unambiguous in practice. The schema doesn't enforce single-parent (the
  // graph model stays flexible); if a future writer adds multiple parents this
  // returns one arbitrarily — revisit then.
  const [row] = await sql()<Row[]>`
    SELECT c.* FROM chunks c
    JOIN chunk_relations cr ON c.id = cr.from_chunk_id
    WHERE cr.to_chunk_id = ${chunkId} AND cr.relation_type = 'PARENT_OF'
    LIMIT 1
  `;
  return row ? map(row) : null;
}

export async function getChildren(chunkId: string): Promise<Chunk[]> {
  const rows = await sql()<Row[]>`
    SELECT c.* FROM chunks c
    JOIN chunk_relations cr ON c.id = cr.to_chunk_id
    WHERE cr.from_chunk_id = ${chunkId} AND cr.relation_type = 'PARENT_OF'
    ORDER BY c.chunk_index ASC
  `;
  return rows.map(map);
}

/**
 * All chunks reachable from `chunkId` within `maxHops`, treating edges as
 * undirected (a reference is relevant both ways). REFERENCES edges genuinely
 * form cycles, so the recursive CTE uses Postgres' `CYCLE` clause: traversal
 * stops as soon as a node repeats on a path (`is_cycle`), which both guarantees
 * termination independent of `maxHops` and avoids redundant re-expansion. The
 * seed is excluded from the result. Acceptable for shallow intra-document graphs
 * (<50 chunks/doc) — the AgeGraphAdapter is the migration path for deep/wide ones.
 *
 * The `${chunkId}::uuid` cast in the anchor is required: postgres.js binds the
 * id as `text`, and the recursive branch yields `uuid` columns — the cast
 * unifies the two branches' `id` type for the UNION.
 */
export async function getRelated(chunkId: string, maxHops = 2): Promise<Chunk[]> {
  const rows = await sql()<Row[]>`
    WITH RECURSIVE walk AS (
      SELECT ${chunkId}::uuid AS id, 0 AS hops
      UNION ALL
      SELECT CASE WHEN cr.from_chunk_id = w.id THEN cr.to_chunk_id ELSE cr.from_chunk_id END AS id,
             w.hops + 1 AS hops
      FROM walk w
      JOIN chunk_relations cr ON (cr.from_chunk_id = w.id OR cr.to_chunk_id = w.id)
      WHERE w.hops < ${maxHops}
    ) CYCLE id SET is_cycle USING path
    SELECT DISTINCT ON (c.id) c.* FROM chunks c
    JOIN walk w ON c.id = w.id
    WHERE w.id <> ${chunkId}::uuid AND NOT w.is_cycle
    ORDER BY c.id
  `;
  return rows.map(map);
}

export async function deleteNode(chunkId: string): Promise<void> {
  // chunk_relations rows cascade via the chunks FK; deleting the chunk suffices.
  await sql()`DELETE FROM chunks WHERE id = ${chunkId}`;
}
