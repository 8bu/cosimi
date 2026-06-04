import { afterEach, expect, it, vi } from "vitest";
import type { EmbeddingPort } from "@cosimi/core";
import { resetCorpus, seedChunk, seedDocument, seedLinkedPair, unitVec } from "./helpers";

// Stub the embedder factory so the query maps to a known vector (unitVec(0)).
const queryVec = unitVec(0);
vi.mock("../src/lib/embedder", () => ({
  resolveEmbedder: (): EmbeddingPort => ({
    dimension: 1024,
    embed: (texts: string[]) => Promise.resolve(texts.map(() => queryVec)),
  }),
  runWithAi: <T>(_ai: unknown, fn: () => T): T => fn(),
}));

const { app } = await import("../src/app");

afterEach(async () => {
  vi.restoreAllMocks();
  await resetCorpus();
});

async function postRetrieve(body: unknown): Promise<Response> {
  return app.fetch(
    new Request("http://localhost/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

it("returns a ranked pair-hit when a pair matches the query", async () => {
  const doc = await seedDocument();
  // chunk far from the query (unitVec(7)) so the answer comes via the pair, not the chunk.
  const chunk = await seedChunk(doc, 0, unitVec(7), "narrative", "About");
  await seedLinkedPair(chunk, "what is the email", "x@y.z", unitVec(0)); // pair aligned with query

  const res = await postRetrieve({ query: "email?" });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { hits: { kind: string; response?: string }[] };
  expect(body.hits.length).toBeGreaterThan(0);
  expect(body.hits[0]!.kind).toBe("pair");
  expect(body.hits[0]!.response).toBe("x@y.z");
});

it("empty hits + unanswered upsert when nothing clears the floor", async () => {
  const doc = await seedDocument();
  await seedChunk(doc, 0, unitVec(7), "careers", "Careers"); // orthogonal, no pairs

  const res = await postRetrieve({ query: "refund?" });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { hits: unknown[] };
  expect(body.hits).toEqual([]);

  const rows = await (await import("@cosimi/adapter-postgres")).sql()<
    { count: number }[]
  >`SELECT count FROM unanswered WHERE source = 'retrieve'`;
  expect(rows).toHaveLength(1);
  expect(rows[0]!.count).toBe(1);
});

it("rejects an empty query with 400", async () => {
  const res = await postRetrieve({ query: "" });
  expect(res.status).toBe(400);
});
