import { normalize } from "@simlm/normalizer";
import type { Source } from "@simlm/types";
import { sql } from "#client";

export interface InsertPairInput {
  input: string;
  response: string;
  source: Source;
  topic?: string | null;
  batch_id?: number | null;
  flagged?: boolean;
}

// normalized_unaccented is intentionally absent from every write path —
// it's a GENERATED ALWAYS ... STORED column (see migrations/002_pairs.sql)
// and Postgres rejects explicit values for it.
export async function insertPair(p: InsertPairInput): Promise<{ id: number }> {
  const db = sql();
  const normalized = normalize(p.input);
  const [row] = await db<{ id: number }[]>`
    INSERT INTO pairs (input, normalized_input, response, source, topic, batch_id, flagged)
    VALUES (
      ${p.input},
      ${normalized},
      ${p.response},
      ${p.source},
      ${p.topic ?? null},
      ${p.batch_id ?? null},
      ${p.flagged ?? false}
    )
    RETURNING id
  `;
  return row!;
}

export async function insertManyPairs(rows: InsertPairInput[]): Promise<number> {
  if (!rows.length) return 0;
  const db = sql();
  const prepared = rows.map((r) => ({
    input: r.input,
    normalized_input: normalize(r.input),
    response: r.response,
    source: r.source,
    topic: r.topic ?? null,
    batch_id: r.batch_id ?? null,
    flagged: r.flagged ?? false,
  }));
  // postgres.js bulk-insert helper: `db(rows, ...cols)` interpolates a
  // multi-row VALUES block. Caller-supplied column list never includes
  // the generated `normalized_unaccented`.
  await db`
    INSERT INTO pairs ${db(
      prepared,
      "input",
      "normalized_input",
      "response",
      "source",
      "topic",
      "batch_id",
      "flagged",
    )}
  `;
  return prepared.length;
}
