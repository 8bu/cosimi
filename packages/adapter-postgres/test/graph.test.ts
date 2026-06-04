import { afterEach, beforeEach, expect, it } from "vitest";
import { sql } from "#client";
import { createDocument } from "#repositories/documents";
import { createChunk } from "#repositories/chunks";
import { addEdge, deleteNode, getChildren, getParent, getRelated } from "#repositories/graph";
import { fakeVector } from "./fake-vector";

let docId: string;
const mk = (i: number, content: string) =>
  createChunk({
    documentId: docId,
    content,
    chunkIndex: i,
    sectionTitle: null,
    embedding: fakeVector(i),
  });

beforeEach(async () => {
  docId = (await createDocument({ title: "G", mimeType: "text/plain", storageKey: "k/g" })).id;
});

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
});

it("getParent resolves a PARENT_OF edge", async () => {
  const parent = await mk(0, "parent");
  const child = await mk(1, "child");
  await addEdge(parent.id, child.id, "PARENT_OF");
  expect((await getParent(child.id))?.content).toBe("parent");
  expect((await getChildren(parent.id)).map((c) => c.content)).toEqual(["child"]);
  expect(await getParent(parent.id)).toBeNull();
});

it("getRelated traverses REFERENCES bidirectionally within maxHops", async () => {
  const a = await mk(0, "a");
  const b = await mk(1, "b");
  const c = await mk(2, "c");
  await addEdge(a.id, b.id, "REFERENCES");
  await addEdge(b.id, c.id, "REFERENCES");
  const oneHop = await getRelated(a.id, 1);
  expect(oneHop.map((x) => x.content).sort()).toEqual(["b"]);
  const twoHop = await getRelated(a.id, 2);
  expect(twoHop.map((x) => x.content).sort()).toEqual(["b", "c"]);
});

it("getRelated terminates on a cycle", async () => {
  const a = await mk(0, "a");
  const b = await mk(1, "b");
  await addEdge(a.id, b.id, "REFERENCES");
  await addEdge(b.id, a.id, "REFERENCES"); // cycle a↔b
  // A large maxHops must not loop forever — the CYCLE clause bounds it.
  const related = await getRelated(a.id, 5);
  expect(related.map((x) => x.content)).toEqual(["b"]);
});

it("getChildren returns children ordered by chunk_index", async () => {
  const parent = await mk(0, "parent");
  const c2 = await mk(2, "second");
  const c1 = await mk(1, "first");
  await addEdge(parent.id, c2.id, "PARENT_OF");
  await addEdge(parent.id, c1.id, "PARENT_OF");
  expect((await getChildren(parent.id)).map((c) => c.content)).toEqual(["first", "second"]);
});

it("addEdge is idempotent (ON CONFLICT DO NOTHING)", async () => {
  const a = await mk(0, "a");
  const b = await mk(1, "b");
  await addEdge(a.id, b.id, "PARENT_OF");
  await addEdge(a.id, b.id, "PARENT_OF"); // must not throw
  expect((await getChildren(a.id)).map((c) => c.content)).toEqual(["b"]);
});

it("deleteNode cascades to chunk_relations", async () => {
  const a = await mk(0, "a");
  const b = await mk(1, "b");
  await addEdge(a.id, b.id, "REFERENCES");
  await deleteNode(b.id);
  const [{ count }] = await sql()<{ count: number }[]>`
    SELECT count(*)::int AS count FROM chunk_relations WHERE from_chunk_id = ${a.id} OR to_chunk_id = ${a.id}
  `;
  expect(count).toBe(0); // the edge to the deleted chunk was cascaded away
});
