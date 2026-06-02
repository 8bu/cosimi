import { randomUUID } from "node:crypto";
import { sql, insertManyPairs, type InsertPairInput } from "@cosimi/db";
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
