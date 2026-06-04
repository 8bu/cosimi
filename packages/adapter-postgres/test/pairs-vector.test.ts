import { afterEach, expect, it } from "vitest";
import { sql } from "#client";
import { insertPair } from "#repositories/pairs";
import { createDocument } from "#repositories/documents";
import { createChunk } from "#repositories/chunks";
import {
  findNearestPairs,
  findPairsByChunks,
  findPairsByStatus,
  setPairVector,
} from "#repositories/pairs";
import { fakeVector } from "./fake-vector";

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
  await sql()`DELETE FROM pairs`;
});

it("setPairVector then findNearestPairs ranks the embedded pair and filters status", async () => {
  const a = await insertPair({ input: "hi", response: "hello", source: "seed", locale: "en" });
  await setPairVector(a.id, { embedding: fakeVector(5), auditStatus: "pass" });
  const b = await insertPair({ input: "bye", response: "later", source: "seed", locale: "en" });
  await setPairVector(b.id, { embedding: fakeVector(900), auditStatus: "pending" });

  const near = await findNearestPairs(fakeVector(5), 5, { status: "pass", locale: "en" });
  expect(near.map((p) => p.id)).toEqual([a.id]); // b is 'pending', excluded
  expect(near[0]!.similarity).toBeGreaterThan(0.99);
  expect(near[0]!.response).toBe("hello");
});

it("findNearestPairs respects locale inclusion (locale OR und)", async () => {
  const en = await insertPair({ input: "x", response: "rx", source: "seed", locale: "en" });
  await setPairVector(en.id, { embedding: fakeVector(5), auditStatus: "pass" });
  const vi = await insertPair({ input: "y", response: "ry", source: "seed", locale: "vi" });
  await setPairVector(vi.id, { embedding: fakeVector(6), auditStatus: "pass" });

  const near = await findNearestPairs(fakeVector(5), 5, { status: "pass", locale: "en" });
  expect(near.map((p) => p.id)).toContain(en.id);
  expect(near.map((p) => p.id)).not.toContain(vi.id); // vi excluded for an 'en' query
});

it("findPairsByChunks maps chunk → pair and re-ranks by cosine", async () => {
  const docId = (await createDocument({ title: "D", mimeType: "text/plain", storageKey: "k" })).id;
  const chunk = await createChunk({
    documentId: docId,
    content: "c",
    chunkIndex: 0,
    sectionTitle: null,
    embedding: fakeVector(5),
  });
  const p = await insertPair({ input: "q", response: "a", source: "llm", locale: "en" });
  await setPairVector(p.id, {
    embedding: fakeVector(5),
    sourceChunk: chunk.id,
    auditStatus: "pass",
  });
  await sql()`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunk.id}, ${p.id})`;

  const hits = await findPairsByChunks([chunk.id], fakeVector(5), 5);
  expect(hits.map((h) => h.id)).toEqual([p.id]);
  expect(hits[0]!.similarity).toBeGreaterThan(0.99);
});

it("findPairsByStatus returns pending pairs", async () => {
  const p = await insertPair({ input: "q", response: "a", source: "llm", locale: "en" });
  await setPairVector(p.id, { embedding: fakeVector(1), auditStatus: "pending" });
  const pending = await findPairsByStatus("pending", 10);
  expect(pending.map((x) => x.id)).toContain(p.id);
});

it("findNearestPairs defaults to status='pass' (excludes pending when status omitted)", async () => {
  const p = await insertPair({ input: "q", response: "a", source: "llm", locale: "en" });
  await setPairVector(p.id, { embedding: fakeVector(5), auditStatus: "pending" });
  const near = await findNearestPairs(fakeVector(5), 5, { locale: "en" }); // no status → defaults to 'pass'
  expect(near.map((x) => x.id)).not.toContain(p.id);
});

it("findNearestPairs includes 'und' pairs for a locale-tagged query", async () => {
  const und = await insertPair({ input: "u", response: "ru", source: "seed", locale: "und" });
  await setPairVector(und.id, { embedding: fakeVector(5), auditStatus: "pass" });
  const near = await findNearestPairs(fakeVector(5), 5, { status: "pass", locale: "en" });
  expect(near.map((p) => p.id)).toContain(und.id); // universal pool fills in for any locale
});

it("setPairVector(id, {embedding}) preserves an existing pending status (no footgun)", async () => {
  const p = await insertPair({ input: "q", response: "a", source: "llm", locale: "en" });
  await setPairVector(p.id, { embedding: fakeVector(1), auditStatus: "pending" });
  await setPairVector(p.id, { embedding: fakeVector(2) }); // omit auditStatus → must NOT flip to 'pass'
  const stillPending = await findPairsByStatus("pending", 10);
  expect(stillPending.map((x) => x.id)).toContain(p.id);
});

it("findNearestPairs excludes soft-deleted pairs", async () => {
  const p = await insertPair({ input: "q", response: "a", source: "seed", locale: "en" });
  await setPairVector(p.id, { embedding: fakeVector(5), auditStatus: "pass" });
  await sql()`UPDATE pairs SET deleted_at = NOW() WHERE id = ${p.id}`;
  const near = await findNearestPairs(fakeVector(5), 5, { status: "pass", locale: "en" });
  expect(near.map((x) => x.id)).not.toContain(p.id);
});

it("findPairsByChunks returns [] for an empty chunk list", async () => {
  expect(await findPairsByChunks([], fakeVector(5), 5)).toEqual([]);
});
