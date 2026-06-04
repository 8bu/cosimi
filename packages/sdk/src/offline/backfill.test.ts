import { afterEach, expect, it } from "vitest";
import {
  sql,
  insertPair,
  setPairVector,
  softDeletePair,
  findActivePairsWithoutEmbedding,
} from "@cosimi/adapter-postgres";
import { createFakeEmbedder } from "@cosimi/adapter-embed-fake";
import { backfillEmbeddings } from "./backfill";

afterEach(async () => {
  await sql()`DELETE FROM pairs`;
});

it("embeds only active null-embedding pairs and reports the count", async () => {
  const a = await insertPair({ input: "x", response: "rx", source: "seed", locale: "en" });
  const b = await insertPair({ input: "y", response: "ry", source: "seed", locale: "en" });
  await softDeletePair(b.id); // soft-deleted → excluded
  const c = await insertPair({ input: "z", response: "rz", source: "seed", locale: "en" });
  await setPairVector(c.id, {
    embedding: Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)),
  }); // already embedded → excluded

  const res = await backfillEmbeddings(
    {
      embedder: createFakeEmbedder(1024),
      findWithoutEmbedding: findActivePairsWithoutEmbedding,
      setPairVector,
    },
    { batchSize: 100 },
  );
  expect(res.embedded).toBe(1);
  const [row] = await sql()<{ has: boolean }[]>`
    SELECT embedding IS NOT NULL AS has FROM pairs WHERE id = ${a.id}`;
  expect(row!.has).toBe(true);
});
