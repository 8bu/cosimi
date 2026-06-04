import { afterAll, afterEach, describe, expect, it } from "vitest";
import { sql } from "@cosimi/adapter-postgres";
import type { EmbeddingPort } from "@cosimi/core";
import { createCosimi } from "@cosimi/sdk";
import { HealthService } from "../src/services/health";

const DIM = 1024;

function fakeEmbedder(dimension = DIM): EmbeddingPort {
  const zero = Array.from({ length: dimension }, () => 0);
  return { dimension, embed: (texts) => Promise.resolve(texts.map(() => zero)) };
}

afterAll(async () => {
  await sql().end({ timeout: 5 });
});

// The graph-schema migration created pairs.embedding as vector(1024) + its hnsw
// index. One test drops the column to simulate an un-migrated DB; restore it
// idempotently after every test so later test files (shared cosimi_test DB) are
// unaffected.
afterEach(async () => {
  await sql()`ALTER TABLE pairs ADD COLUMN IF NOT EXISTS embedding vector(1024)`;
  await sql()`CREATE INDEX IF NOT EXISTS pairs_embedding_idx ON pairs USING hnsw (embedding vector_cosine_ops)`;
});

describe("cosimi.healthcheck()", () => {
  it("matching embedder + graph-schema migrations applied → schema ready, ok", async () => {
    const report = await createCosimi({ sql, embedder: fakeEmbedder(DIM) }).healthcheck();
    expect(report.db).toBe("up");
    expect(report.schema).toBe("ready");
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("pairs.embedding column absent → schema absent + actionable issue", async () => {
    await sql()`DROP INDEX IF EXISTS pairs_embedding_idx`;
    await sql()`ALTER TABLE pairs DROP COLUMN IF EXISTS embedding`;
    const report = await createCosimi({ sql, embedder: fakeEmbedder(DIM) }).healthcheck();
    expect(report.schema).toBe("absent");
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/pairs\.embedding column absent/);
  });

  it("DB column dimension != embedder dimension → mismatch reported", async () => {
    // The construction guard forbids embedder.dimension != EMBEDDING_DIM, so test
    // the HealthService directly with a 768-dim against the real vector(1024) DB.
    const svc = new HealthService({ sql, embedderDimension: 768 });
    const report = await svc.check();
    expect(report.schema).toBe("absent");
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/dimension mismatch/i);
  });

  it("DB unreachable → db down, not ok", async () => {
    const throwing = (() => {
      throw new Error("connection refused");
    }) as unknown as typeof sql;
    const svc = new HealthService({ sql: throwing, embedderDimension: DIM });
    const report = await svc.check();
    expect(report.db).toBe("down");
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/unreachable/i);
  });
});
