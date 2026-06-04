import { afterEach, beforeEach, expect, it } from "vitest";
import { sql } from "#client";
import { createDocument } from "#repositories/documents";
import {
  createChunk,
  createManyChunks,
  findChunksByDocument,
  findNearestChunks,
} from "#repositories/chunks";
import { fakeVector } from "./fake-vector";

let docId: string;

beforeEach(async () => {
  const doc = await createDocument({ title: "D", mimeType: "text/markdown", storageKey: "k/d" });
  docId = doc.id;
});

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
});

it("creates a chunk and reads it back with parsed embedding", async () => {
  const c = await createChunk({
    documentId: docId,
    content: "hello",
    chunkIndex: 0,
    sectionTitle: "Intro",
    embedding: fakeVector(1),
  });
  expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(c.embedding).toHaveLength(1024);
  const byDoc = await findChunksByDocument(docId);
  expect(byDoc).toHaveLength(1);
  expect(byDoc[0]!.content).toBe("hello");
});

it("createManyChunks inserts in index order", async () => {
  await createManyChunks([
    {
      documentId: docId,
      content: "a",
      chunkIndex: 0,
      sectionTitle: null,
      embedding: fakeVector(1),
    },
    {
      documentId: docId,
      content: "b",
      chunkIndex: 1,
      sectionTitle: null,
      embedding: fakeVector(2),
    },
  ]);
  const byDoc = await findChunksByDocument(docId);
  expect(byDoc.map((c) => c.content)).toEqual(["a", "b"]);
});

it("findNearestChunks ranks the matching seed first", async () => {
  await createManyChunks([
    {
      documentId: docId,
      content: "target",
      chunkIndex: 0,
      sectionTitle: null,
      embedding: fakeVector(7),
    },
    {
      documentId: docId,
      content: "other",
      chunkIndex: 1,
      sectionTitle: null,
      embedding: fakeVector(999),
    },
  ]);
  const near = await findNearestChunks(fakeVector(7), 2);
  expect(near[0]!.content).toBe("target");
  expect(near[0]!.similarity).toBeGreaterThan(near[1]!.similarity);
  // identical vector → cos ≈ 1 (not exactly 1.0: pgvector stores float32, JS is float64)
  expect(near[0]!.similarity).toBeGreaterThan(0.99);
});

it("findNearestChunks excludes null-embedding chunks", async () => {
  await createChunk({
    documentId: docId,
    content: "no-embed",
    chunkIndex: 0,
    sectionTitle: null,
    embedding: null,
  });
  await createChunk({
    documentId: docId,
    content: "has-embed",
    chunkIndex: 1,
    sectionTitle: null,
    embedding: fakeVector(1),
  });
  const near = await findNearestChunks(fakeVector(1), 5);
  expect(near).toHaveLength(1);
  expect(near[0]!.content).toBe("has-embed");
});

it("findNearestChunks honors the limit", async () => {
  await createManyChunks([
    {
      documentId: docId,
      content: "a",
      chunkIndex: 0,
      sectionTitle: null,
      embedding: fakeVector(1),
    },
    {
      documentId: docId,
      content: "b",
      chunkIndex: 1,
      sectionTitle: null,
      embedding: fakeVector(2),
    },
    {
      documentId: docId,
      content: "c",
      chunkIndex: 2,
      sectionTitle: null,
      embedding: fakeVector(3),
    },
  ]);
  const near = await findNearestChunks(fakeVector(1), 2);
  expect(near).toHaveLength(2);
});
