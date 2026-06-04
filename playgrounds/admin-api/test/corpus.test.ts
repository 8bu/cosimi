import { afterEach, expect, it } from "vitest";
import { sql, insertManyPairs } from "@cosimi/adapter-postgres";
import { app } from "../src/app";

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
  await sql()`DELETE FROM pairs`;
});

async function seed() {
  const [doc] = await sql()<{ id: string }[]>`
    INSERT INTO documents (title, mime_type, storage_key) VALUES ('D', 'text/markdown', 'd.md') RETURNING id
  `;
  const [chunk] = await sql()<{ id: string }[]>`
    INSERT INTO chunks (document_id, content, chunk_index, section_title)
    VALUES (${doc!.id}, 'chunk body', 0, 'Intro') RETURNING id
  `;
  await insertManyPairs([{ input: "q1", response: "a1", source: "llm" }]);
  const [pair] = await sql()<
    { id: number }[]
  >`SELECT id::int AS id FROM pairs ORDER BY id DESC LIMIT 1`;
  await sql()`UPDATE pairs SET audit_status = 'pass' WHERE id = ${pair!.id}`;
  await sql()`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunk!.id}, ${pair!.id})`;
  return { docId: doc!.id, chunkId: chunk!.id, pairId: pair!.id };
}

it("lists a document's chunks", async () => {
  const { docId, chunkId } = await seed();
  const res = await app.fetch(new Request(`http://localhost/documents/${docId}/chunks`));
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    chunks: { id: string; section_title: string; chunk_index: number }[];
  };
  expect(body.chunks).toHaveLength(1);
  expect(body.chunks[0]!.id).toBe(chunkId);
  expect(body.chunks[0]!.section_title).toBe("Intro");
});

it("lists a chunk's pairs", async () => {
  const { chunkId } = await seed();
  const res = await app.fetch(new Request(`http://localhost/chunks/${chunkId}/pairs`));
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    pairs: { input: string; response: string; audit_status: string }[];
  };
  expect(body.pairs).toHaveLength(1);
  expect(body.pairs[0]!.input).toBe("q1");
  expect(body.pairs[0]!.audit_status).toBe("pass");
});
