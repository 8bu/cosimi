import type postgres from "postgres";
import type { Chunk, NewChunk, ScoredChunk } from "@cosimi/db-core";
import { sql } from "#client";
import { fromVector, toVector } from "../vector";

type Executor = postgres.Sql | postgres.TransactionSql;

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

export async function createChunk(c: NewChunk, tx?: Executor): Promise<Chunk> {
  const db = tx ?? sql();
  const [row] = await db<Row[]>`
    INSERT INTO chunks (document_id, content, chunk_index, section_title, embedding)
    VALUES (
      ${c.documentId}, ${c.content}, ${c.chunkIndex}, ${c.sectionTitle},
      ${c.embedding === null ? null : toVector(c.embedding)}::vector
    )
    RETURNING *
  `;
  return map(row!);
}

export async function createManyChunks(chunks: NewChunk[], tx?: Executor): Promise<Chunk[]> {
  // SP2 TODO: at M1 scale (a handful of chunks/doc) sequential inserts are fine.
  // The offline pipeline may create hundreds of chunks per document — switch to
  // a single bulk `db(prepared, ...cols) RETURNING *` (postgres.js preserves row
  // order) before SP2's ingest path calls this in volume.
  const out: Chunk[] = [];
  for (const c of chunks) out.push(await createChunk(c, tx));
  return out;
}

export async function findChunkById(id: string): Promise<Chunk | null> {
  const [row] = await sql()<Row[]>`SELECT * FROM chunks WHERE id = ${id}`;
  return row ? map(row) : null;
}

export async function findChunksByDocument(documentId: string): Promise<Chunk[]> {
  const rows = await sql()<Row[]>`
    SELECT * FROM chunks WHERE document_id = ${documentId} ORDER BY chunk_index ASC
  `;
  return rows.map(map);
}

export async function findNearestChunks(
  embedding: number[],
  limit: number,
): Promise<ScoredChunk[]> {
  const q = toVector(embedding);
  const rows = await sql()<(Row & { similarity: number })[]>`
    SELECT *, 1 - (embedding <=> ${q}::vector) AS similarity
    FROM chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${q}::vector
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ ...map(r), similarity: r.similarity }));
}

export async function deleteChunk(id: string): Promise<void> {
  await sql()`DELETE FROM chunks WHERE id = ${id}`;
}
