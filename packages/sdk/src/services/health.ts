import type { SqlAccessor } from "@cosimi/retriever";

/**
 * A point-in-time readiness probe for a {@link CosimiClient}'s database. Opt-in:
 * the consumer calls it once after startup (never at construction — the SDK does
 * no I/O at build time, staying Workers-safe). Reports whether the DB is
 * reachable and migrated for GraphRAG retrieval.
 */
export interface HealthReport {
  /** True when there are no blocking issues. */
  ok: boolean;
  /** Database reachability. */
  db: "up" | "down";
  /**
   * GraphRAG schema readiness:
   *  - "ready"  — `pairs.embedding` (matching dimension) + `chunks` +
   *               `chunk_pair_map` all present.
   *  - "absent" — one or more of the above is missing or mismatched; see `issues`.
   */
  schema: "ready" | "absent";
  /** Human-readable, actionable problems; empty when `ok`. */
  issues: string[];
}

export interface HealthServiceDeps {
  sql: SqlAccessor;
  /** The configured embedder's dimension (embedder is mandatory). */
  embedderDimension: number;
}

/**
 * Runs the readiness queries over the injected sql accessor. Kept as a small
 * service so the client stays a thin facade.
 */
export class HealthService {
  readonly #sql: SqlAccessor;
  readonly #dim: number;

  constructor(deps: HealthServiceDeps) {
    this.#sql = deps.sql;
    this.#dim = deps.embedderDimension;
  }

  async check(): Promise<HealthReport> {
    const issues: string[] = [];

    // DB reachability + GraphRAG schema (embedding column dimension + chunk
    // tables). A connection failure is terminal — we can't probe anything else.
    let colDim: number | null = null;
    let hasChunkTables = false;
    try {
      // pgvector stores the column dimension in atttypmod (no offset).
      const [col] = await this.#sql()<{ dim: number | null }[]>`
        SELECT a.atttypmod AS dim
        FROM pg_attribute a
        WHERE a.attrelid = to_regclass('pairs')
          AND a.attname = 'embedding'
          AND NOT a.attisdropped
      `;
      const [tbls] = await this.#sql()<{ chunks: string | null; map: string | null }[]>`
        SELECT to_regclass('chunks')::text AS chunks,
               to_regclass('chunk_pair_map')::text AS map
      `;
      colDim = col?.dim ?? null;
      hasChunkTables = tbls?.chunks != null && tbls?.map != null;
    } catch (err) {
      return {
        ok: false,
        db: "down",
        schema: "absent",
        issues: [`Database unreachable: ${(err as Error).message}`],
      };
    }

    if (colDim === null || colDim <= 0) {
      issues.push(
        "GraphRAG schema missing: run the migrations (pnpm migrate / applyMigrations) " +
          "(pairs.embedding column absent).",
      );
    } else if (colDim !== this.#dim) {
      issues.push(
        `GraphRAG dimension mismatch: pairs.embedding is vector(${colDim}) but the ` +
          `configured embedder is ${this.#dim}. Re-migrate or use a matching embedder.`,
      );
    } else if (!hasChunkTables) {
      issues.push(
        "GraphRAG schema incomplete: chunks/chunk_pair_map tables absent " +
          "(run the migrations: pnpm migrate / applyMigrations).",
      );
    }

    return {
      ok: issues.length === 0,
      db: "up",
      schema: issues.length === 0 ? "ready" : "absent",
      issues,
    };
  }
}
