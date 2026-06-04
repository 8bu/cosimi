import { sql } from "@cosimi/adapter-postgres";
import { toVectorLiteral } from "@cosimi/retriever";

export const EMBED_DIM = 1024;

/**
 * Build a deterministic unit vector of length EMBED_DIM from sparse entries
 * `{ index: weight }`, L2-normalized so cosine similarity between two such
 * vectors is the normalized dot product. Basis vectors `mkVec({0:1})` and
 * `mkVec({1:1})` are orthogonal (cosine 0); `mkVec({0:Math.cos(t),1:Math.sin(t)})`
 * makes cosine `cos(t)` against `mkVec({0:1})`. Lets tests pin exact sims.
 */
export function mkVec(entries: Record<number, number>): number[] {
  const v = Array.from({ length: EMBED_DIM }, () => 0);
  for (const [i, w] of Object.entries(entries)) v[Number(i)] = w;
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/** UPDATE a pair's embedding (+ audit_status) in place — raw, like the soft-delete fixture. */
export async function setPairEmbedding(
  pairId: number,
  vec: number[],
  auditStatus = "pass",
): Promise<void> {
  const db = sql();
  await db`
    UPDATE pairs
    SET embedding = ${toVectorLiteral(vec)}::vector, audit_status = ${auditStatus}
    WHERE id = ${pairId}
  `;
}
