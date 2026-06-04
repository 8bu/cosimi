import { afterEach, expect, it } from "vitest";
import {
  sql,
  createDocument,
  createChunk,
  insertPair,
  setPairVector,
  mapChunkToPair,
  setPairStatus,
  updatePairResponse,
  softDeletePair,
  addEdge,
} from "@cosimi/adapter-postgres";
import { createFakeLLM } from "@cosimi/adapter-llm-fake";
import { createFakeEmbedder } from "@cosimi/adapter-embed-fake";
import type { StorageRepository } from "@cosimi/db-core";
import { createIngestService } from "./ingest-service";
import type { IngestDeps } from "./types";

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
  await sql()`DELETE FROM pairs`;
});

const noopStorage: StorageRepository = {
  upload: () => Promise.resolve(),
  download: () => Promise.resolve(new Uint8Array()),
  delete: () => Promise.resolve(),
};

function makeDeps(responder: (system: string) => string): IngestDeps {
  const llm = createFakeLLM(({ system }) => responder(system));
  return {
    storage: noopStorage,
    generateLLM: llm,
    auditLLM: llm,
    embedder: createFakeEmbedder(1024),
    documents: { create: createDocument },
    chunks: { create: createChunk },
    graph: { addEdge: (f, t, ty) => addEdge(f, t, ty) },
    pairs: { insertPair, setPairVector },
    mapChunkToPair,
    setPairStatus,
    updatePairResponse,
    softDeletePair,
  };
}

function passResponder(system: string): string {
  if (system.includes("Q&A pair generator")) return '[{"q":"what?","a":"this."}]';
  if (system.includes("cross-references")) return "[]";
  if (system.includes("QA auditor"))
    return '{"verdict":"pass","reason":"ok","rewritten_answer":null}';
  return "a question?";
}

it("ingests a markdown doc end to end: documents, chunks, passed pairs, map rows", async () => {
  const res = await createIngestService(makeDeps(passResponder), { minGenTokens: 0 }).ingest({
    title: "Doc",
    content: "## Alpha\nAlpha body text here.\n## Beta\nBeta body text here.",
    mimeType: "text/markdown",
    locale: "en",
  });
  expect(res.chunkCount).toBe(2);
  expect(res.pairs.generated).toBe(2);
  expect(res.pairs.pass).toBe(2);
  const [docCount] = await sql()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM documents`;
  expect(docCount!.n).toBe(1);
  const [chunkCount] = await sql()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM chunks`;
  expect(chunkCount!.n).toBe(2); // rows actually landed (not just the return value)
  const [pairCount] = await sql()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM pairs WHERE audit_status = 'pass' AND embedding IS NOT NULL`;
  expect(pairCount!.n).toBe(2);
  const [mapCount] = await sql()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM chunk_pair_map`;
  expect(mapCount!.n).toBe(2);
});

it("persists cross-reference relations as REFERENCES graph edges", async () => {
  const deps = makeDeps((system) => {
    if (system.includes("Q&A pair generator")) return '[{"q":"q","a":"a"}]';
    if (system.includes("cross-references")) return '[{"from":0,"to":2,"type":"references"}]';
    if (system.includes("QA auditor"))
      return '{"verdict":"pass","reason":"ok","rewritten_answer":null}';
    return "x?";
  });
  const res = await createIngestService(deps, { minGenTokens: 0 }).ingest({
    title: "Multi",
    content: "## A\nbody a here.\n## B\nbody b here.\n## C\nbody c here.",
    mimeType: "text/markdown",
  });
  expect(res.chunkCount).toBe(3);
  expect(res.relationCount).toBe(1);
  const [refs] = await sql()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM chunk_relations WHERE relation_type = 'REFERENCES'`;
  expect(refs!.n).toBe(1);
});

it("splits an oversized section: PARENT_OF edges, parent is not a pair source", async () => {
  // Tiny splitThreshold forces the single section to split into a structural
  // parent + sentence-grouped children. Only the leaves generate pairs.
  const res = await createIngestService(makeDeps(passResponder), {
    splitThreshold: 5,
    minGenTokens: 0,
  }).ingest({
    title: "Big",
    content: "## Big\nS1 alpha sentence. S2 beta sentence. S3 gamma sentence. S4 delta sentence.",
    mimeType: "text/markdown",
  });
  expect(res.chunkCount).toBeGreaterThanOrEqual(3); // 1 parent + >=2 children
  const [chunkCount] = await sql()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM chunks`;
  expect(chunkCount!.n).toBe(res.chunkCount);
  const [parentEdges] = await sql()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM chunk_relations WHERE relation_type = 'PARENT_OF'`;
  expect(parentEdges!.n).toBe(res.chunkCount - 1); // every child linked to the lone parent
  // Parent excluded from generation → one pair per leaf child.
  expect(res.pairs.generated).toBe(res.chunkCount - 1);
});

it("fail verdict soft-deletes the generated pair", async () => {
  const deps = makeDeps((system) => {
    if (system.includes("Q&A pair generator")) return '[{"q":"q","a":"a"}]';
    if (system.includes("cross-references")) return "[]";
    if (system.includes("QA auditor"))
      return '{"verdict":"fail","reason":"bad","rewritten_answer":null}';
    return "x?";
  });
  const res = await createIngestService(deps, { minGenTokens: 0 }).ingest({
    title: "D",
    content: "plain text only, no headings here please.",
    mimeType: "text/plain",
  });
  expect(res.pairs.fail).toBe(1);
  const [alive] = await sql()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM pairs WHERE deleted_at IS NULL`;
  expect(alive!.n).toBe(0);
});

it("rewrite verdict updates the response and re-embeds (pair stays pass)", async () => {
  const deps = makeDeps((system) => {
    if (system.includes("Q&A pair generator")) return '[{"q":"q","a":"old answer"}]';
    if (system.includes("cross-references")) return "[]";
    if (system.includes("QA auditor"))
      return '{"verdict":"rewrite","reason":"fix","rewritten_answer":"new answer"}';
    return "x?";
  });
  const res = await createIngestService(deps, { minGenTokens: 0 }).ingest({
    title: "D",
    content: "plain body text for one chunk.",
    mimeType: "text/plain",
    locale: "en",
  });
  expect(res.pairs.rewrite).toBe(1);
  const [row] = await sql()<{ response: string; audit_status: string }[]>`
    SELECT response, audit_status FROM pairs WHERE deleted_at IS NULL LIMIT 1`;
  expect(row!.response).toBe("new answer");
  expect(row!.audit_status).toBe("pass");
});

it("reverse check flags a drifting pair", async () => {
  const deps = makeDeps((system) => {
    if (system.includes("Q&A pair generator")) return '[{"q":"q","a":"a"}]';
    if (system.includes("cross-references")) return "[]";
    if (system.includes("QA auditor"))
      return '{"verdict":"pass","reason":"ok","rewritten_answer":null}';
    return "an unrelated regenerated question"; // orthogonal to "q: a" in fake-embedder space
  });
  const res = await createIngestService(deps, {
    reverseCheck: true,
    reverseCheckThreshold: 0.75,
    minGenTokens: 0,
  }).ingest({ title: "D", content: "body text here.", mimeType: "text/plain" });
  expect(res.pairs.flagged).toBe(1);
});

it("skips relations for <3 chunks and survives malformed generation", async () => {
  const deps = makeDeps((system) => {
    if (system.includes("Q&A pair generator")) return "not json at all";
    if (system.includes("cross-references")) return "[]";
    if (system.includes("QA auditor"))
      return '{"verdict":"pass","reason":"ok","rewritten_answer":null}';
    return "x?";
  });
  const res = await createIngestService(deps, { minGenTokens: 0 }).ingest({
    title: "D",
    content: "## A\nbody a\n## B\nbody b",
    mimeType: "text/markdown",
  });
  expect(res.relationCount).toBe(0);
  expect(res.pairs.generated).toBe(0);
});

it("skips pair generation for fact-poor chunks below minGenTokens", async () => {
  // The generation LLM would dutifully emit pairs, but the token gate must skip
  // the chunk entirely so retrieval isn't polluted by heading/label fragments.
  const deps = makeDeps((system) => {
    if (system.includes("Q&A pair generator")) return '[{"q":"q","a":"a"}]';
    if (system.includes("cross-references")) return "[]";
    if (system.includes("QA auditor"))
      return '{"verdict":"pass","reason":"ok","rewritten_answer":null}';
    return "x?";
  });
  const res = await createIngestService(deps, { minGenTokens: 12 }).ingest({
    title: "Tiny",
    content: "## Experience\nFull-time Remote",
    mimeType: "text/markdown",
  });
  expect(res.chunkCount).toBe(1); // chunk still persisted as a retrieval target…
  expect(res.pairs.generated).toBe(0); // …but spawns no pairs
  const [pairCount] = await sql()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM pairs`;
  expect(pairCount!.n).toBe(0);
});
