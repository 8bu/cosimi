import type postgres from "postgres";
import { sql } from "#client";

type Executor = postgres.Sql | postgres.TransactionSql;

/** Link a chunk to a generated pair (Tier-3 join table). Idempotent. */
export async function mapChunkToPair(
  chunkId: string,
  pairId: number,
  tx?: Executor,
): Promise<void> {
  const db = tx ?? sql();
  await db`
    INSERT INTO chunk_pair_map (chunk_id, pair_id)
    VALUES (${chunkId}, ${pairId})
    ON CONFLICT DO NOTHING
  `;
}
