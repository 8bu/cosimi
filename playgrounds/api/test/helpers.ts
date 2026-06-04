import { randomUUID } from "node:crypto";
import { sql, insertManyPairs, type InsertPairInput } from "@cosimi/adapter-postgres";
import type { ChatStreamEvent } from "@cosimi/core";

/**
 * TRUNCATE every Phase 5–touched table so each test starts from a clean
 * slate. `CASCADE` walks the FKs (session_teaches → teach_queue, votes →
 * pairs) so we don't have to enumerate dependent rows.
 */
export async function resetDb(): Promise<void> {
  await sql()`
    TRUNCATE pairs, session_teaches, sessions, teach_queue, import_batches, votes, unanswered
    RESTART IDENTITY CASCADE
  `;
}

/**
 * Insert seed pairs through the canonical write path; never raw INSERT.
 * `id::int` because BIGSERIAL ships as a string under postgres.js — we
 * want real `number` ids so tests can pass them straight to JSON
 * bodies that validate against `v.number()`.
 */
export async function seedPairs(rows: InsertPairInput[]): Promise<number[]> {
  if (!rows.length) return [];
  await insertManyPairs(rows);
  const inserted = await sql()<{ id: number }[]>`
    SELECT id::int AS id FROM pairs ORDER BY id ASC
  `;
  return inserted.map((r) => r.id);
}

/**
 * Drain a Hono streamSSE response. With app.fetch() the response stream
 * may sit buffered until something reads it; for tests that depend on
 * the handler's DB writes having committed, call this before issuing
 * the next request.
 */
export async function drain(res: Response): Promise<void> {
  await res.text();
}

export const newSessionId = (): string => randomUUID();

/**
 * Hit the in-process Hono app over its fetch interface — no socket,
 * no @hono/node-server. Fetch lets us await response.text() to consume
 * the SSE stream synchronously, which is exactly what tests want.
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

/**
 * Parse the SSE body produced by streamChat. Each frame is `data: …\n\n`.
 * Returns the list of JSON-decoded ChatStreamEvent objects (the [DONE]
 * terminator is stripped).
 */
export async function consumeChatStream(res: Response): Promise<ChatStreamEvent[]> {
  const text = await res.text();
  const events: ChatStreamEvent[] = [];
  for (const block of text.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    const payload = line.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    events.push(JSON.parse(payload) as ChatStreamEvent);
  }
  return events;
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
