import { afterEach, expect, it } from "vitest";
import { sql } from "@cosimi/adapter-postgres";
import { app } from "../src/app";

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
  await sql()`DELETE FROM pairs`;
});

it("lists ingested documents", async () => {
  await sql()`
    INSERT INTO documents (title, mime_type, storage_key)
    VALUES ('Alpha', 'text/markdown', 'a.md'), ('Beta', 'text/markdown', 'b.md')
  `;
  const res = await app.fetch(new Request("http://localhost/documents"));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { documents: { title: string }[] };
  expect(body.documents).toHaveLength(2);
  expect(body.documents.map((d) => d.title).toSorted()).toEqual(["Alpha", "Beta"]);
});

it("returns an empty array when there are no documents", async () => {
  const res = await app.fetch(new Request("http://localhost/documents"));
  const body = (await res.json()) as { documents: unknown[] };
  expect(body.documents).toEqual([]);
});

it("includes chunk and pair counts per document", async () => {
  const [doc] = await sql()<{ id: string }[]>`
    INSERT INTO documents (title, mime_type, storage_key)
    VALUES ('Counted', 'text/markdown', 'c.md') RETURNING id
  `;
  const [chunk] = await sql()<{ id: string }[]>`
    INSERT INTO chunks (document_id, content, chunk_index) VALUES (${doc!.id}, 'x', 0) RETURNING id
  `;
  const { insertManyPairs } = await import("@cosimi/adapter-postgres");
  await insertManyPairs([{ input: "q", response: "a", source: "llm" }]);
  const [pair] = await sql()<
    { id: number }[]
  >`SELECT id::int AS id FROM pairs ORDER BY id DESC LIMIT 1`;
  await sql()`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunk!.id}, ${pair!.id})`;

  const res = await app.fetch(new Request("http://localhost/documents"));
  const body = (await res.json()) as {
    documents: { title: string; chunkCount: number; pairCount: number }[];
  };
  const row = body.documents.find((d) => d.title === "Counted")!;
  expect(row.chunkCount).toBe(1);
  expect(row.pairCount).toBe(1);
});

it("deletes a document, cascading chunks and purging generated pairs", async () => {
  const [doc] = await sql()<{ id: string }[]>`
    INSERT INTO documents (title, mime_type, storage_key)
    VALUES ('Doomed', 'text/markdown', 'd.md') RETURNING id
  `;
  const [chunk] = await sql()<{ id: string }[]>`
    INSERT INTO chunks (document_id, content, chunk_index) VALUES (${doc!.id}, 'x', 0) RETURNING id
  `;
  const { insertManyPairs } = await import("@cosimi/adapter-postgres");
  await insertManyPairs([{ input: "q", response: "a", source: "llm" }]);
  const [pair] = await sql()<
    { id: number }[]
  >`SELECT id::int AS id FROM pairs ORDER BY id DESC LIMIT 1`;
  await sql()`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunk!.id}, ${pair!.id})`;

  const res = await app.fetch(
    new Request(`http://localhost/documents/${doc!.id}`, { method: "DELETE" }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, deletedPairs: 1 });

  const [docs] = await sql()<{ n: number }[]>`SELECT count(*)::int AS n FROM documents`;
  expect(docs!.n).toBe(0);
  const [chunks] = await sql()<{ n: number }[]>`SELECT count(*)::int AS n FROM chunks`;
  expect(chunks!.n).toBe(0); // cascaded
  const [pairs] = await sql()<{ n: number }[]>`SELECT count(*)::int AS n FROM pairs`;
  expect(pairs!.n).toBe(0); // purged, not orphaned
});

it("returns 404 for an unknown document id", async () => {
  const res = await app.fetch(
    new Request("http://localhost/documents/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
    }),
  );
  expect(res.status).toBe(404);
});

it("returns 400 for a malformed document id", async () => {
  const res = await app.fetch(
    new Request("http://localhost/documents/not-a-uuid", { method: "DELETE" }),
  );
  expect(res.status).toBe(400);
});
