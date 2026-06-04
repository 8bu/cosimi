import type postgres from "postgres";
import { normalize } from "@cosimi/normalizer";
import type { AuditStatus, InsertPairInput, ScoredPair } from "@cosimi/db-core";
import { sql } from "#client";
import { toVector } from "../vector";

export type { InsertPairInput };

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

/**
 * Set the embedding (always) plus optional provenance/audit status on a pair
 * created via insertPair. `source_chunk` and `audit_status` are written ONLY
 * when explicitly provided — so the M5 backfill path (`setPairVector(id, {
 * embedding })`) embeds a curated pair WITHOUT silently flipping its audit
 * status or clearing its source. The pipeline passes `auditStatus: 'pending'`
 * explicitly to queue a generated pair for audit.
 */
export async function setPairVector(
  id: number,
  v: { embedding: number[]; sourceChunk?: string | null; auditStatus?: AuditStatus },
  tx?: Executor,
): Promise<void> {
  const db = tx ?? sql();
  await db`
    UPDATE pairs SET
      embedding = ${toVector(v.embedding)}::vector
      ${v.sourceChunk !== undefined ? db`, source_chunk = ${v.sourceChunk}` : db``}
      ${v.auditStatus !== undefined ? db`, audit_status = ${v.auditStatus}` : db``}
    WHERE id = ${id}
  `;
}

interface ScoredRow {
  id: number;
  input: string;
  response: string;
  locale: string;
  similarity: number;
}

/** Nearest pairs by cosine; excludes soft-deleted + null-embedding rows. */
export async function findNearestPairs(
  embedding: number[],
  limit: number,
  opts: { status?: AuditStatus; locale?: string } = {},
): Promise<ScoredPair[]> {
  const db = sql();
  const q = toVector(embedding);
  // Default 'und' mirrors the matcher's default locale: omitting locale matches
  // only the universal pool. Runtime callers (the SDK match loop) always pass a
  // concrete locale; 'und'-tagged pairs are included alongside it.
  const locale = opts.locale ?? "und";
  // Safe-by-default: this is a runtime retrieval that serves user replies, so it
  // must never surface unaudited/rejected pairs — status defaults to 'pass'
  // (matching findPairsByChunks, which hardcodes it). Pass an explicit status
  // only for non-serving callers (e.g. admin/debug inspection).
  const status = opts.status ?? "pass";
  const rows = await db<ScoredRow[]>`
    SELECT id::int AS id, input, response, locale, 1 - (embedding <=> ${q}::vector) AS similarity
    FROM pairs
    WHERE deleted_at IS NULL
      AND embedding IS NOT NULL
      AND audit_status = ${status}
      AND (locale = ${locale} OR locale = 'und')
    ORDER BY embedding <=> ${q}::vector
    LIMIT ${limit}
  `;
  return rows;
}

/** Pairs mapped from the given chunk ids (via chunk_pair_map), re-ranked by cosine. */
export async function findPairsByChunks(
  chunkIds: string[],
  embedding: number[],
  limit: number,
): Promise<ScoredPair[]> {
  if (chunkIds.length === 0) return [];
  const q = toVector(embedding);
  const rows = await sql()<ScoredRow[]>`
    SELECT DISTINCT p.id::int AS id, p.input, p.response, p.locale,
           1 - (p.embedding <=> ${q}::vector) AS similarity
    FROM pairs p
    JOIN chunk_pair_map m ON m.pair_id = p.id
    WHERE m.chunk_id = ANY(${chunkIds}::uuid[])
      AND p.deleted_at IS NULL
      AND p.embedding IS NOT NULL
      AND p.audit_status = 'pass'
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;
  return rows;
}

/** Pairs in a given audit status (pipeline audit step). */
export async function findPairsByStatus(
  status: AuditStatus,
  limit: number,
): Promise<{ id: number; input: string; response: string }[]> {
  return sql()<{ id: number; input: string; response: string }[]>`
    SELECT id::int AS id, input, response
    FROM pairs
    WHERE deleted_at IS NULL AND audit_status = ${status}
    ORDER BY id ASC
    LIMIT ${limit}
  `;
}

/**
 * Flip audit_status only (embedding untouched). Deliberately EXCLUDES 'fail' and
 * 'rewrite': a fail transition must soft-delete (use softDeletePair), and a rewrite
 * must also rewrite the response + re-embed — flipping the status alone in either
 * case leaves a half-applied pair (e.g. audit_status='fail' but deleted_at IS NULL,
 * silently excluded from serving yet still surfaced by findPairsByStatus). Callers
 * may only set the terminal serving statuses.
 */
export async function setPairStatus(
  id: number,
  status: Exclude<AuditStatus, "fail" | "rewrite">,
  tx?: Executor,
): Promise<void> {
  const db = tx ?? sql();
  await db`UPDATE pairs SET audit_status = ${status} WHERE id = ${id}`;
}

/** Replace the response text (audit 'rewrite'). Leaves input/normalized_input untouched. */
export async function updatePairResponse(
  id: number,
  response: string,
  tx?: Executor,
): Promise<void> {
  const db = tx ?? sql();
  await db`UPDATE pairs SET response = ${response} WHERE id = ${id}`;
}

/** Soft-delete a single pair (audit 'fail'). No-op if already deleted. */
export async function softDeletePair(id: number, tx?: Executor): Promise<void> {
  const db = tx ?? sql();
  await db`UPDATE pairs SET deleted_at = NOW() WHERE id = ${id} AND deleted_at IS NULL`;
}

/** Backfill source: active pairs whose embedding is still NULL, oldest first. */
export async function findActivePairsWithoutEmbedding(
  limit: number,
): Promise<{ id: number; input: string; response: string }[]> {
  return sql()<{ id: number; input: string; response: string }[]>`
    SELECT id::int AS id, input, response
    FROM pairs
    WHERE deleted_at IS NULL AND embedding IS NULL
    ORDER BY id ASC
    LIMIT ${limit}
  `;
}
