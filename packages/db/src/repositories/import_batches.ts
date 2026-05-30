import type { Source } from "@cosimi/types";
import { sql } from "#client";

export async function createBatch(source: Source, topic?: string, note?: string): Promise<number> {
  const db = sql();
  // `id::int AS id` keeps the return type a real `number` — BIGSERIAL ships
  // as a string by default through postgres.js, which would break JSON
  // wire shapes (admin /import returns batch_id to clients verbatim).
  const [row] = await db<{ id: number }[]>`
    INSERT INTO import_batches (source, topic, note)
    VALUES (${source}, ${topic ?? null}, ${note ?? null})
    RETURNING id::int AS id
  `;
  return row!.id;
}

export async function setBatchCount(id: number, count: number): Promise<void> {
  const db = sql();
  await db`UPDATE import_batches SET count = ${count} WHERE id = ${id}`;
}
