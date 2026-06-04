import { afterEach, expect, it } from "vitest";
import { sql } from "#client";
import {
  createDocument,
  deleteDocument,
  findDocumentById,
  listDocuments,
} from "#repositories/documents";

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
});

it("creates and reads back a document", async () => {
  const doc = await createDocument({
    title: "Doc A",
    mimeType: "text/markdown",
    storageKey: "k/a.md",
  });
  expect(doc.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(doc.title).toBe("Doc A");
  const found = await findDocumentById(doc.id);
  expect(found?.storageKey).toBe("k/a.md");
});

it("lists documents newest first", async () => {
  await createDocument({ title: "old", mimeType: "text/plain", storageKey: "k/old" });
  await createDocument({ title: "new", mimeType: "text/plain", storageKey: "k/new" });
  const all = await listDocuments();
  expect(all.map((d) => d.title)).toEqual(["new", "old"]);
});

it("returns null for a missing id and deletes", async () => {
  const doc = await createDocument({ title: "X", mimeType: "text/plain", storageKey: "k/x" });
  await deleteDocument(doc.id);
  expect(await findDocumentById(doc.id)).toBeNull();
});
