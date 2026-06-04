import { sql, insertManyPairs } from "@cosimi/adapter-postgres";

/**
 * Hit the in-process Hono app over its fetch interface — no socket,
 * no @hono/node-server.
 */
export type AppLike = { fetch: (req: Request) => Response | Promise<Response> };

export async function postJson(
  app: AppLike,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

export async function getJson(
  app: AppLike,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method: "GET", headers }));
}

/** A `dim`-length unit vector with 1.0 at `idx`, else 0 — deterministic, orthogonal. */
export function unitVec(idx: number, dim = 1024): number[] {
  const v = Array.from({ length: dim }, () => 0);
  v[idx] = 1;
  return v;
}

/** pgvector literal for a JS number[]. */
export function vlit(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/** Insert one chunk with an embedding; returns its id. */
export async function seedChunk(
  documentId: string,
  chunkIndex: number,
  vec: number[],
  content = "chunk content",
  sectionTitle = "Section",
): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    INSERT INTO chunks (document_id, content, chunk_index, section_title, embedding)
    VALUES (${documentId}, ${content}, ${chunkIndex}, ${sectionTitle}, ${vlit(vec)}::vector)
    RETURNING id
  `;
  return row!.id;
}

/** Insert a document; returns its id. */
export async function seedDocument(title = "kb"): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    INSERT INTO documents (title, mime_type, storage_key)
    VALUES (${title}, 'text/markdown', ${title + ".md"}) RETURNING id
  `;
  return row!.id;
}

/** Insert a pair, set its embedding, and link it to a chunk. Returns pair id. */
export async function seedLinkedPair(
  chunkId: string,
  input: string,
  response: string,
  vec: number[],
): Promise<number> {
  await insertManyPairs([{ input, response, source: "llm" }]);
  const [row] = await sql()<{ id: number }[]>`
    SELECT id::int AS id FROM pairs WHERE input = ${input} ORDER BY id DESC LIMIT 1
  `;
  const id = row!.id;
  await sql()`UPDATE pairs SET embedding = ${vlit(vec)}::vector, audit_status = 'pass' WHERE id = ${id}`;
  await sql()`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunkId}, ${id})`;
  return id;
}

/** Truncate the GraphRAG corpus tables between retrieve tests. */
export async function resetCorpus(): Promise<void> {
  await sql()`TRUNCATE documents CASCADE`;
  await sql()`DELETE FROM pairs`;
  await sql()`DELETE FROM unanswered`;
}
