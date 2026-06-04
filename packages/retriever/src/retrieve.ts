import type { ChunkHit, PairBrief, PairHit, RelatedChunk, RetrievalResult } from "@cosimi/core";
import type { SqlAccessor } from "./types";
import { toVectorLiteral } from "./vec";

export interface RetrieveOptions {
  /** Query embedding (raw query, embedded once by the caller). */
  queryEmbedding: number[];
  /** Max hits returned (pairs + chunks intermixed). */
  topK: number;
  /** Candidates pulled from EACH pool (pairs, chunks) before merge. */
  seedK: number;
  /** Graph expansion (hops) for a pair-hit's context chunks. */
  maxHops: number;
  /** Cosine floor on hits. */
  minSimilarity: number;
  /** Optional pair-locale filter; 'und' always eligible. */
  locales?: string[];
}

type HitRow = { kind: "pair" | "chunk"; id: string; similarity: number };

/**
 * Unified retrieval (runtime, LLM-free, deterministic). Searches pairs AND chunks
 * as equal embedded targets: top-seedK of each pool by cosine, merged + floored +
 * ranked into one hit list (topK). A pair-hit carries its source chunk + graph
 * neighbors (<= maxHops) as context; a chunk-hit carries its linked pairs.
 * Reverses the old chunk-anchored model (umbrella D5).
 */
export async function retrieve(sql: SqlAccessor, opts: RetrieveOptions): Promise<RetrievalResult> {
  const q = toVectorLiteral(opts.queryEmbedding);
  const locales = opts.locales && opts.locales.length > 0 ? opts.locales : null;

  // 1. Unified hit ranking. Two index-friendly ANN sub-selects (each keeps its
  //    hnsw index), floored, merged, ranked. pair ids cast ::text for a uniform
  //    column with chunk uuids.
  const hitRows = locales
    ? await sql()<HitRow[]>`
        WITH pair_near AS (
          SELECT id::text AS id, 1 - (embedding <=> ${q}::vector) AS similarity
          FROM pairs
          WHERE embedding IS NOT NULL AND deleted_at IS NULL AND audit_status = 'pass'
            AND (locale = ANY(${locales}) OR locale = 'und')
          ORDER BY embedding <=> ${q}::vector ASC LIMIT ${opts.seedK}
        ),
        chunk_near AS (
          SELECT id::text AS id, 1 - (embedding <=> ${q}::vector) AS similarity
          FROM chunks WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${q}::vector ASC LIMIT ${opts.seedK}
        )
        SELECT 'pair' AS kind, id, similarity FROM pair_near WHERE similarity >= ${opts.minSimilarity}
        UNION ALL
        SELECT 'chunk' AS kind, id, similarity FROM chunk_near WHERE similarity >= ${opts.minSimilarity}
        ORDER BY similarity DESC, kind ASC, id ASC
        LIMIT ${opts.topK}
      `
    : await sql()<HitRow[]>`
        WITH pair_near AS (
          SELECT id::text AS id, 1 - (embedding <=> ${q}::vector) AS similarity
          FROM pairs
          WHERE embedding IS NOT NULL AND deleted_at IS NULL AND audit_status = 'pass'
          ORDER BY embedding <=> ${q}::vector ASC LIMIT ${opts.seedK}
        ),
        chunk_near AS (
          SELECT id::text AS id, 1 - (embedding <=> ${q}::vector) AS similarity
          FROM chunks WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${q}::vector ASC LIMIT ${opts.seedK}
        )
        SELECT 'pair' AS kind, id, similarity FROM pair_near WHERE similarity >= ${opts.minSimilarity}
        UNION ALL
        SELECT 'chunk' AS kind, id, similarity FROM chunk_near WHERE similarity >= ${opts.minSimilarity}
        ORDER BY similarity DESC, kind ASC, id ASC
        LIMIT ${opts.topK}
      `;

  if (hitRows.length === 0) return { hits: [] };

  const pairHitIds = hitRows.filter((h) => h.kind === "pair").map((h) => Number(h.id));
  const chunkHitIds = hitRows.filter((h) => h.kind === "chunk").map((h) => h.id);

  // 2. Pair details + each pair's source chunk id.
  type PairDetail = { id: number; input: string; response: string; source_chunk: string };
  const pairDetails =
    pairHitIds.length > 0
      ? await sql()<PairDetail[]>`
          SELECT p.id::int AS id, p.input, p.response, m.chunk_id AS source_chunk
          FROM pairs p JOIN chunk_pair_map m ON m.pair_id = p.id
          WHERE p.id = ANY(${pairHitIds})
        `
      : [];
  const pairById = new Map(pairDetails.map((p) => [p.id, p]));

  // 3. Graph neighbors of every pair source chunk (root-carrying recursive walk).
  type WalkRow = { root: string; id: string; hops: number };
  const sourceChunkIds = pairDetails.map((p) => p.source_chunk);
  const walkRows: WalkRow[] =
    sourceChunkIds.length > 0
      ? await sql()<WalkRow[]>`
          WITH RECURSIVE roots AS (
            SELECT id AS root, id, 0 AS hops FROM chunks WHERE id = ANY(${sourceChunkIds})
            UNION ALL
            SELECT r.root,
                   CASE WHEN cr.from_chunk_id = r.id THEN cr.to_chunk_id ELSE cr.from_chunk_id END AS id,
                   r.hops + 1
            FROM roots r
            JOIN chunk_relations cr ON (cr.from_chunk_id = r.id OR cr.to_chunk_id = r.id)
            WHERE r.hops < ${opts.maxHops}
          ) CYCLE id SET is_cycle USING path
          SELECT root, id, MIN(hops) AS hops FROM roots WHERE NOT is_cycle GROUP BY root, id
        `
      : [];

  // 4. Content for every chunk we reference (chunk-hits + all walked context chunks).
  const allChunkIds = Array.from(new Set([...chunkHitIds, ...walkRows.map((w) => w.id)]));
  type ChunkDetail = {
    id: string;
    document_id: string;
    content: string;
    section_title: string | null;
    similarity: number;
  };
  const chunkDetails =
    allChunkIds.length > 0
      ? await sql()<ChunkDetail[]>`
          SELECT id, document_id, content, section_title, 1 - (embedding <=> ${q}::vector) AS similarity
          FROM chunks WHERE id = ANY(${allChunkIds})
        `
      : [];
  const chunkById = new Map(chunkDetails.map((c) => [c.id, c]));

  // 5. Pairs linked to each chunk-hit (for ChunkHit.pairs).
  type ChunkPairRow = { chunk_id: string; input: string; response: string; similarity: number };
  const chunkPairs =
    chunkHitIds.length > 0
      ? locales
        ? await sql()<ChunkPairRow[]>`
            SELECT m.chunk_id, p.input, p.response, 1 - (p.embedding <=> ${q}::vector) AS similarity
            FROM chunk_pair_map m JOIN pairs p ON p.id = m.pair_id
            WHERE m.chunk_id = ANY(${chunkHitIds}) AND p.deleted_at IS NULL
              AND p.audit_status = 'pass' AND p.embedding IS NOT NULL
              AND (p.locale = ANY(${locales}) OR p.locale = 'und')
            ORDER BY similarity DESC, p.id ASC
          `
        : await sql()<ChunkPairRow[]>`
            SELECT m.chunk_id, p.input, p.response, 1 - (p.embedding <=> ${q}::vector) AS similarity
            FROM chunk_pair_map m JOIN pairs p ON p.id = m.pair_id
            WHERE m.chunk_id = ANY(${chunkHitIds}) AND p.deleted_at IS NULL
              AND p.audit_status = 'pass' AND p.embedding IS NOT NULL
            ORDER BY similarity DESC, p.id ASC
          `
      : [];
  const pairsByChunk = new Map<string, PairBrief[]>();
  for (const r of chunkPairs) {
    const list = pairsByChunk.get(r.chunk_id) ?? [];
    list.push({ input: r.input, response: r.response, similarity: r.similarity });
    pairsByChunk.set(r.chunk_id, list);
  }

  // context chunks grouped by root (source chunk), sorted hops ASC then id.
  const ctxByRoot = new Map<string, RelatedChunk[]>();
  for (const w of walkRows) {
    const cd = chunkById.get(w.id);
    if (!cd) continue;
    const list = ctxByRoot.get(w.root) ?? [];
    list.push({
      id: cd.id,
      documentId: cd.document_id,
      content: cd.content,
      sectionTitle: cd.section_title,
      hops: w.hops,
      similarity: cd.similarity,
    });
    ctxByRoot.set(w.root, list);
  }
  for (const list of ctxByRoot.values())
    list.sort((a, b) => a.hops - b.hops || a.id.localeCompare(b.id));

  // 6. Assemble hits in the ranked order.
  const hits = hitRows.map((h): PairHit | ChunkHit => {
    if (h.kind === "pair") {
      const pd = pairById.get(Number(h.id))!;
      return {
        kind: "pair",
        similarity: h.similarity,
        input: pd.input,
        response: pd.response,
        context: ctxByRoot.get(pd.source_chunk) ?? [],
      };
    }
    const cd = chunkById.get(h.id)!;
    return {
      kind: "chunk",
      similarity: h.similarity,
      chunk: {
        id: cd.id,
        documentId: cd.document_id,
        content: cd.content,
        sectionTitle: cd.section_title,
        hops: 0,
        similarity: cd.similarity,
      },
      pairs: pairsByChunk.get(cd.id) ?? [],
    };
  });

  return { hits };
}
