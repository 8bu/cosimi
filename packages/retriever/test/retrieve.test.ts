import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@cosimi/adapter-postgres";
import { retrieve, type RetrieveOptions } from "@cosimi/retriever";
import { mkVec } from "./fixtures";
import { seedHitFixtures } from "./retrieve-fixtures";

afterAll(async () => {
  await sql().end({ timeout: 5 });
});

function opts(queryEmbedding: number[], over: Partial<RetrieveOptions> = {}): RetrieveOptions {
  return { queryEmbedding, topK: 8, seedK: 4, maxHops: 2, minSimilarity: 0.3, ...over };
}

describe("retrieve (unified hits)", () => {
  beforeEach(async () => {
    await sql()`TRUNCATE pairs, chunk_pair_map, chunk_relations, chunks, documents, session_teaches, sessions, teach_queue, import_batches, votes, unanswered RESTART IDENTITY CASCADE`;
  });

  it("ranks a pair-hit above a chunk-hit when the pair is the closer match", async () => {
    const f = await seedHitFixtures();
    const res = await retrieve(sql, opts(f.queryVec));
    expect(res.hits.length).toBe(2);
    expect(res.hits[0]!.kind).toBe("pair");
    expect(res.hits[1]!.kind).toBe("chunk");
    expect(res.hits[0]!.similarity).toBeGreaterThan(res.hits[1]!.similarity);
  });

  it("a pair-hit carries its source chunk (hops 0) + graph neighbors as context", async () => {
    const f = await seedHitFixtures();
    const res = await retrieve(sql, opts(f.queryVec));
    const pairHit = res.hits.find((h) => h.kind === "pair");
    if (!pairHit || pairHit.kind !== "pair") throw new Error("expected a pair hit");
    expect(pairHit.response).toBe("x@y.z");
    const ctxIds = pairHit.context.map((c) => c.id);
    expect(ctxIds).toContain(f.chunkA);
    expect(ctxIds).toContain(f.chunkB);
    expect(pairHit.context.find((c) => c.id === f.chunkA)!.hops).toBe(0);
    expect(pairHit.context.find((c) => c.id === f.chunkB)!.hops).toBe(1);
  });

  it("a chunk-hit carries its linked pairs", async () => {
    const f = await seedHitFixtures();
    const { insertManyPairs } = await import("@cosimi/adapter-postgres");
    const { setPairEmbedding } = await import("./fixtures");
    await insertManyPairs([{ input: "skills", response: "ts + vue", source: "llm" }]);
    const [p] = await sql()<{ id: number }[]>`
      SELECT id::int AS id FROM pairs WHERE input='skills' ORDER BY id DESC LIMIT 1`;
    await setPairEmbedding(p!.id, mkVec({ 5: 1 })); // low query sim -> not a pair-hit itself
    await sql()`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${f.chunkC}, ${p!.id})`;

    const res = await retrieve(sql, opts(f.queryVec));
    const chunkHit = res.hits.find((h) => h.kind === "chunk" && h.chunk.id === f.chunkC);
    expect(chunkHit).toBeTruthy();
    if (chunkHit && chunkHit.kind === "chunk") {
      expect(chunkHit.pairs.map((pr) => pr.response)).toContain("ts + vue");
    }
  });

  it("empties when nothing clears the floor", async () => {
    await seedHitFixtures();
    const res = await retrieve(sql, opts(mkVec({ 9: 1 }), { minSimilarity: 0.5 }));
    expect(res.hits).toEqual([]);
  });

  it("is deterministic (same input -> identical output)", async () => {
    const f = await seedHitFixtures();
    const a = await retrieve(sql, opts(f.queryVec));
    const b = await retrieve(sql, opts(f.queryVec));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
