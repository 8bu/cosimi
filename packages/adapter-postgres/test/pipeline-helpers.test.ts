import { afterEach, expect, it } from "vitest";
import { sql } from "#client";
import {
  insertPair,
  setPairVector,
  setPairStatus,
  updatePairResponse,
  softDeletePair,
  findActivePairsWithoutEmbedding,
} from "#repositories/pairs";
import { createDocument } from "#repositories/documents";
import { createChunk } from "#repositories/chunks";
import { mapChunkToPair } from "#repositories/chunk_pair_map";
import { fakeVector } from "./fake-vector";

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
  await sql()`DELETE FROM pairs`;
});

it("setPairStatus flips audit_status without touching embedding", async () => {
  const p = await insertPair({ input: "q", response: "a", source: "llm", locale: "en" });
  await setPairVector(p.id, { embedding: fakeVector(1) }); // embedding only; audit_status stays default
  await setPairStatus(p.id, "pass");
  const [row] = await sql()<{ audit_status: string; has_emb: boolean }[]>`
    SELECT audit_status, embedding IS NOT NULL AS has_emb FROM pairs WHERE id = ${p.id}`;
  expect(row!.audit_status).toBe("pass");
  expect(row!.has_emb).toBe(true);
});

it("updatePairResponse changes response, leaves normalized_input alone", async () => {
  const p = await insertPair({ input: "How OLD?", response: "old", source: "llm", locale: "en" });
  await updatePairResponse(p.id, "I am 25");
  const [row] = await sql()<{ response: string; normalized_input: string }[]>`
    SELECT response, normalized_input FROM pairs WHERE id = ${p.id}`;
  expect(row!.response).toBe("I am 25");
  expect(row!.normalized_input).toBe("how old?"); // unchanged by the rewrite
});

it("softDeletePair sets deleted_at and is idempotent", async () => {
  const p = await insertPair({ input: "q", response: "a", source: "llm", locale: "en" });
  await softDeletePair(p.id);
  await softDeletePair(p.id); // no-op second time
  const [row] = await sql()<{ deleted_at: Date | null }[]>`
    SELECT deleted_at FROM pairs WHERE id = ${p.id}`;
  expect(row!.deleted_at).not.toBeNull();
});

it("findActivePairsWithoutEmbedding returns only active null-embedding rows", async () => {
  const a = await insertPair({ input: "no-emb", response: "x", source: "seed", locale: "en" });
  const b = await insertPair({ input: "has-emb", response: "y", source: "seed", locale: "en" });
  await setPairVector(b.id, { embedding: fakeVector(2) });
  const c = await insertPair({ input: "deleted", response: "z", source: "seed", locale: "en" });
  await softDeletePair(c.id);

  const rows = await findActivePairsWithoutEmbedding(50);
  expect(rows.map((r) => r.id)).toEqual([a.id]);
  expect(rows[0]).toEqual({ id: a.id, input: "no-emb", response: "x" });
});

it("mapChunkToPair links chunk↔pair and is idempotent", async () => {
  const doc = await createDocument({ title: "D", mimeType: "text/plain", storageKey: "k" });
  const chunk = await createChunk({
    documentId: doc.id,
    content: "c",
    chunkIndex: 0,
    sectionTitle: null,
    embedding: null,
  });
  const p = await insertPair({ input: "q", response: "a", source: "llm", locale: "en" });
  await mapChunkToPair(chunk.id, p.id);
  await mapChunkToPair(chunk.id, p.id); // ON CONFLICT DO NOTHING
  const rows = await sql()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM chunk_pair_map WHERE chunk_id = ${chunk.id} AND pair_id = ${p.id}`;
  expect(rows[0]!.n).toBe(1);
});
