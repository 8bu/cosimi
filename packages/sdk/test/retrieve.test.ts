import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql, insertManyPairs } from "@cosimi/adapter-postgres";
import type { EmbeddingPort } from "@cosimi/core";
import { createCosimi } from "@cosimi/sdk";

const DIM = 1024;
function unit(entries: Record<number, number>): number[] {
  const v = Array.from({ length: DIM }, () => 0);
  for (const [i, w] of Object.entries(entries)) v[Number(i)] = w;
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}
function fixedEmbedder(vec: number[], dimension = DIM): EmbeddingPort & { calls: number } {
  return {
    dimension,
    calls: 0,
    embed(texts) {
      this.calls += 1;
      return Promise.resolve(texts.map(() => vec));
    },
  };
}

afterAll(async () => {
  await sql().end({ timeout: 5 });
});

describe("cosimi.retrieve()", () => {
  beforeEach(async () => {
    await sql()`TRUNCATE pairs, chunk_pair_map, chunk_relations, chunks, documents, session_teaches, sessions, teach_queue, import_batches, votes, unanswered RESTART IDENTITY CASCADE`;
  });

  it("throws at construction when no embedder is provided", () => {
    // embedder is now mandatory — createCosimi throws synchronously, not on retrieve()
    expect(() => createCosimi({ sql } as Parameters<typeof createCosimi>[0])).toThrow(
      /requires an embedder/,
    );
  });

  it("embeds the query once and returns unified hits (pair + chunk)", async () => {
    const [doc] = await sql()<{ id: string }[]>`
      INSERT INTO documents (title, mime_type, storage_key) VALUES ('d','text/markdown','d.md') RETURNING id
    `;
    const [chunk] = await sql()<{ id: string }[]>`
      INSERT INTO chunks (document_id, content, chunk_index, embedding)
      VALUES (${doc!.id}, 'refund window is 30 days', 0, ${`[${unit({ 0: 1 }).join(",")}]`}::vector)
      RETURNING id
    `;
    await insertManyPairs([{ input: "refund time", response: "30 days", source: "llm" }]);
    const [p] = await sql()<{ id: number }[]>`SELECT id::int AS id FROM pairs LIMIT 1`;
    await sql()`UPDATE pairs SET embedding = ${`[${unit({ 0: 1 }).join(",")}]`}::vector, audit_status='pass' WHERE id = ${p!.id}`;
    await sql()`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunk!.id}, ${p!.id})`;

    const emb = fixedEmbedder(unit({ 0: 1 }));
    const cosimi = createCosimi({ sql, embedder: emb });
    const res = await cosimi.retrieve("how long for a refund");

    expect(emb.calls).toBe(1);
    // chunk (sim ~1) and pair (sim ~1) both clear the floor → two hits.
    expect(res.hits).toHaveLength(2);
    const pairHit = res.hits.find((h) => h.kind === "pair");
    expect(pairHit?.kind).toBe("pair");
    if (pairHit?.kind === "pair") expect(pairHit.response).toBe("30 days");
    const chunkHit = res.hits.find((h) => h.kind === "chunk");
    expect(chunkHit?.kind).toBe("chunk");
    if (chunkHit?.kind === "chunk") expect(chunkHit.chunk.id).toBe(chunk!.id);
  });

  it("returns empty hits when nothing clears the floor", async () => {
    const cosimi = createCosimi({ sql, embedder: fixedEmbedder(unit({ 5: 1 })) });
    const res = await cosimi.retrieve("unrelated");
    expect(res.hits).toEqual([]);
  });
});
