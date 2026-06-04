import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sql } from "@cosimi/adapter-postgres";
import {
  addEdge,
  createChunk,
  createDocument,
  insertPair,
  mapChunkToPair,
  setPairStatus,
  setPairVector,
  softDeletePair,
  updatePairResponse,
} from "@cosimi/adapter-postgres";
import { createFakeLLM } from "@cosimi/adapter-llm-fake";
import { createFakeEmbedder } from "@cosimi/adapter-embed-fake";
import type { StorageRepository } from "@cosimi/db-core";
import type { IngestDeps } from "@cosimi/sdk/offline";
import { postJson, postRaw } from "./helpers";

const noopStorage: StorageRepository = {
  upload: () => Promise.resolve(),
  download: () => Promise.resolve(new Uint8Array()),
  delete: () => Promise.resolve(),
};

function passResponder(system: string): string {
  if (system.includes("Q&A pair generator")) return '[{"q":"what?","a":"this."}]';
  if (system.includes("cross-references")) return "[]";
  if (system.includes("QA auditor"))
    return '{"verdict":"pass","reason":"ok","rewritten_answer":null}';
  return "a question?";
}

function fakeDeps(): IngestDeps {
  const llm = createFakeLLM(({ system }) => passResponder(system));
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

const spies = vi.hoisted(() => ({ buildIngestDeps: vi.fn() }));
vi.mock("../src/lib/ingest-deps", () => ({ buildIngestDeps: spies.buildIngestDeps }));

const { app } = await import("../src/app");
const { sweepRunning } = await import("../src/lib/ingest-jobs");

const KEY_HEADER = { "x-anthropic-key": "sk-test-key" };

interface JobBody {
  status: "running" | "done" | "error";
  pairsPassed: number;
  chunksTotal: number;
  documentId: string | null;
  error: string | null;
}

/** Ingest is async (202 + jobId) — poll the job row until it settles. */
async function waitForJob(jobId: string, timeoutMs = 5000): Promise<JobBody> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await app.fetch(new Request(`http://localhost/ingest/jobs/${jobId}`));
    const job = (await res.json()) as JobBody;
    if (job.status !== "running") return job;
    if (Date.now() > deadline) throw new Error(`job ${jobId} still running after ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

afterEach(async () => {
  await sql()`TRUNCATE documents CASCADE`;
  await sql()`DELETE FROM pairs`;
  await sql()`DELETE FROM ingest_jobs`;
});

beforeEach(() => {
  spies.buildIngestDeps.mockReset();
  spies.buildIngestDeps.mockImplementation(() => fakeDeps());
});

it("accepts a pasted document (202 + jobId), runs detached, forwards the api key", async () => {
  const res = await postJson(
    app,
    "/ingest",
    {
      title: "Doc",
      // Section bodies clear the ingest service's minGenTokens gate (heading-only
      // fragments are skipped), so both chunks generate a pair.
      content:
        "## Alpha\nThe Alpha section documents the first subsystem and its responsibilities in detail.\n## Beta\nThe Beta section documents the second subsystem and connects back to the Alpha module.",
      locale: "en",
    },
    KEY_HEADER,
  );
  expect(res.status).toBe(202);
  const { jobId } = (await res.json()) as { jobId: string };
  expect(typeof jobId).toBe("string");

  const job = await waitForJob(jobId);
  expect(job.status).toBe("done");
  expect(job.chunksTotal).toBe(2); // two leaf chunks
  expect(job.pairsPassed).toBe(2);
  expect(job.documentId).toBeTruthy();
  // The key reaches the detached job (where deps are built), not the request.
  expect(spies.buildIngestDeps).toHaveBeenCalledWith("sk-test-key");

  const [docs] = await sql()<{ n: number }[]>`SELECT count(*)::int AS n FROM documents`;
  expect(docs!.n).toBe(1);
  // Pairs created BY this job's document (global pair count isn't test-isolated
  // across files). job.pairsPassed already asserts the count; this confirms the
  // rows actually landed and are linked to the produced document.
  const [pairs] = await sql()<{ n: number }[]>`
    SELECT count(DISTINCT m.pair_id)::int AS n
      FROM chunk_pair_map m JOIN chunks ch ON ch.id = m.chunk_id
     WHERE ch.document_id = ${job.documentId}
  `;
  expect(pairs!.n).toBe(2);
});

it("ingests an uploaded document (raw body + X-Doc-Title)", async () => {
  const res = await postRaw(app, "/ingest", "## A\nbody a here.\n## B\nbody b here.", {
    "content-type": "text/markdown",
    "x-doc-title": "Uploaded",
    ...KEY_HEADER,
  });
  expect(res.status).toBe(202);
  const { jobId } = (await res.json()) as { jobId: string };
  const job = await waitForJob(jobId);
  expect(job.status).toBe("done");
  const [doc] = await sql()<{ title: string }[]>`SELECT title FROM documents LIMIT 1`;
  expect(doc!.title).toBe("Uploaded");
});

it("records a job error when the pipeline throws (no crash)", async () => {
  spies.buildIngestDeps.mockImplementationOnce(() => {
    throw new Error("boom from deps");
  });
  const res = await postJson(
    app,
    "/ingest",
    { title: "Doomed", content: "## A\nbody." },
    KEY_HEADER,
  );
  expect(res.status).toBe(202); // request already accepted
  const { jobId } = (await res.json()) as { jobId: string };
  const job = await waitForJob(jobId);
  expect(job.status).toBe("error");
  expect(job.error).toContain("boom from deps");
});

it("GET /ingest/jobs/:id is 404 unknown, 400 malformed", async () => {
  const a = await app.fetch(
    new Request("http://localhost/ingest/jobs/00000000-0000-0000-0000-000000000000"),
  );
  expect(a.status).toBe(404);
  const b = await app.fetch(new Request("http://localhost/ingest/jobs/not-a-uuid"));
  expect(b.status).toBe(400);
});

it("sweepRunning fails orphaned running jobs (boot recovery)", async () => {
  await sql()`INSERT INTO ingest_jobs (title, status) VALUES ('orphan', 'running')`;
  const swept = await sweepRunning();
  expect(swept).toBeGreaterThanOrEqual(1);
  const [row] = await sql()<{ status: string; error: string }[]>`
    SELECT status, error FROM ingest_jobs WHERE title = 'orphan'`;
  expect(row!.status).toBe("error");
  expect(row!.error).toContain("interrupted");
});

it("rejects a request without the X-Anthropic-Key header (400)", async () => {
  const res = await postJson(app, "/ingest", { title: "Doc", content: "## A\nbody." });
  expect(res.status).toBe(400);
  expect(spies.buildIngestDeps).not.toHaveBeenCalled();
});

it("rejects a paste body without a title (400)", async () => {
  const res = await postJson(app, "/ingest", { content: "x" }, KEY_HEADER);
  expect(res.status).toBe(400);
});

it("rejects an upload without X-Doc-Title (400)", async () => {
  const res = await postRaw(app, "/ingest", "## A\nbody.", { "content-type": "text/markdown" });
  expect(res.status).toBe(400);
});
