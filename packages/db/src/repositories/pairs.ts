import type postgres from "postgres";
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
  // BCP-47 locale tag. Missing → 'und' (universal); the column has a
  // matching default at the schema level (migration 010), but routing
  // the default through the helper keeps the JS-side write shape
  // explicit so admin tools / tests don't accidentally drop it.
  locale?: string;
}

// postgres.Sql is the pool client; postgres.TransactionSql is the handle
// passed to .begin() callbacks. Both extend the same template-literal API
// (`ISql`), so accepting either keeps the canonical write path reusable
// inside transactions — that's how admin-api's teach-queue approval
// atomically promotes a queue row into `pairs`.
type Executor = postgres.Sql | postgres.TransactionSql;

// normalized_unaccented is intentionally absent from every write path —
// it's a GENERATED ALWAYS ... STORED column (see migrations/002_pairs.sql)
// and Postgres rejects explicit values for it.
//
// `RETURNING id::int AS id` casts BIGSERIAL away from postgres.js's
// default-string representation; AdminPair / wire schemas expect numeric
// ids so the cast keeps the boundary symmetric.
export async function insertPair(p: InsertPairInput, tx?: Executor): Promise<{ id: number }> {
  const db = tx ?? sql();
  const normalized = normalize(p.input);
  const [row] = await db<{ id: number }[]>`
    INSERT INTO pairs (input, normalized_input, response, source, topic, batch_id, flagged, locale)
    VALUES (
      ${p.input},
      ${normalized},
      ${p.response},
      ${p.source},
      ${p.topic ?? null},
      ${p.batch_id ?? null},
      ${p.flagged ?? false},
      ${p.locale ?? "und"}
    )
    RETURNING id::int AS id
  `;
  return row!;
}

export async function insertManyPairs(rows: InsertPairInput[], tx?: Executor): Promise<number> {
  if (!rows.length) return 0;
  const db = tx ?? sql();
  const prepared = rows.map((r) => ({
    input: r.input,
    normalized_input: normalize(r.input),
    response: r.response,
    source: r.source,
    topic: r.topic ?? null,
    batch_id: r.batch_id ?? null,
    flagged: r.flagged ?? false,
    locale: r.locale ?? "und",
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
      "locale",
    )}
  `;
  return prepared.length;
}
