import type { EmbeddingPort } from "@cosimi/core";
import type { PairRepository } from "@cosimi/db-core";

export interface BackfillDeps {
  embedder: EmbeddingPort;
  findWithoutEmbedding: (
    limit: number,
  ) => Promise<{ id: number; input: string; response: string }[]>;
  setPairVector: PairRepository["setPairVector"];
}

/**
 * Embed curated pairs that predate Tier-2/3 (embedding IS NULL) so they become
 * Tier-2-eligible (spec §7). Embeds `"${input}: ${response}"` (content-based);
 * leaves `audit_status` as-is (curated default 'pass'). Loops in batches until dry.
 */
export async function backfillEmbeddings(
  deps: BackfillDeps,
  opts: { batchSize?: number } = {},
): Promise<{ embedded: number }> {
  const batchSize = opts.batchSize ?? 100;
  let embedded = 0;
  for (;;) {
    const rows = await deps.findWithoutEmbedding(batchSize);
    if (rows.length === 0) break;
    const vectors = await deps.embedder.embed(rows.map((r) => `${r.input}: ${r.response}`));
    for (let i = 0; i < rows.length; i++) {
      await deps.setPairVector(rows[i]!.id, { embedding: vectors[i]! });
      embedded++;
    }
    if (rows.length < batchSize) break;
  }
  return { embedded };
}
