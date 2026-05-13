import type { Source } from "@simlm/types";
import { sql } from "#client";

export async function createBatch(source: Source, topic?: string, note?: string): Promise<number> {
  const db = sql();
  const [row] = await db<{ id: number }[]>`
    INSERT INTO import_batches (source, topic, note)
    VALUES (${source}, ${topic ?? null}, ${note ?? null})
    RETURNING id
  `;
  return row!.id;
}

export async function setBatchCount(id: number, count: number): Promise<void> {
  const db = sql();
  await db`UPDATE import_batches SET count = ${count} WHERE id = ${id}`;
}
