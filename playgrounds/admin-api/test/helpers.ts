import { insertManyPairs, sql, type InsertPairInput } from "@cosimi/adapter-postgres";

/**
 * Truncate all admin-touched tables. CASCADE walks the FKs (chunk_pair_map →
 * pairs, chunks → documents) so we don't enumerate dependents. `app_config`
 * is excluded — it holds seeded config the tests read.
 */
export async function resetDb(): Promise<void> {
  await sql()`
    TRUNCATE pairs, import_batches, unanswered, documents, ingest_jobs
    RESTART IDENTITY CASCADE
  `;
}

/**
 * Insert seed pairs through the canonical write path; never raw INSERT.
 * Returns numeric ids (BIGSERIAL casts to int via SELECT after insert).
 */
export async function seedPairs(rows: InsertPairInput[]): Promise<number[]> {
  if (!rows.length) return [];
  await insertManyPairs(rows);
  const inserted = await sql()<{ id: number }[]>`
    SELECT id::int AS id FROM pairs ORDER BY id ASC
  `;
  return inserted.map((r) => r.id);
}

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

export async function postRaw(
  app: AppLike,
  path: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers,
      body,
    }),
  );
}

export async function patchJson(
  app: AppLike,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteReq(
  app: AppLike,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method: "DELETE", headers }));
}

export async function getJson(
  app: AppLike,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method: "GET", headers }));
}
