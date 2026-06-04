import { Hono } from "hono";
import * as v from "valibot";
import {
  createIngestService,
  type IngestInput,
  type IngestOptions,
  type IngestProgress,
} from "@cosimi/sdk/offline";

import { buildIngestDeps } from "../lib/ingest-deps";
import { createJob, failJob, finishJob, getJob, listJobs, writeProgress } from "../lib/ingest-jobs";

const OptionsSchema = v.object({
  pairsPerChunk: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20))),
  reverseCheck: v.optional(v.boolean()),
});

const PasteSchema = v.object({
  title: v.pipe(v.string(), v.nonEmpty(), v.maxLength(200)),
  content: v.pipe(v.string(), v.nonEmpty()),
  locale: v.optional(v.pipe(v.string(), v.maxLength(16))),
  options: v.optional(OptionsSchema),
});

const UuidSchema = v.pipe(v.string(), v.uuid());

export const ingestRoute = new Hono();

/**
 * Run the offline pipeline detached, mirroring progress onto the job row. The
 * Anthropic key is captured in this closure ONLY — never persisted. Errors are
 * caught and written to the row (the request already returned 202), so a failed
 * ingest never crashes the process.
 */
function runJobDetached(
  jobId: string,
  apiKey: string,
  input: IngestInput,
  options: IngestOptions,
): void {
  void (async () => {
    try {
      const deps = {
        ...buildIngestDeps(apiKey),
        onProgress: (p: IngestProgress) => writeProgress(jobId, p),
      };
      const result = await createIngestService(deps, options).ingest(input);
      await finishJob(jobId, result.documentId, result.pairs.pass);
    } catch (err) {
      await failJob(jobId, err instanceof Error ? err.message : "ingest failed").catch(() => {});
    }
  })();
}

/**
 * Offline document ingest — ASYNCHRONOUS. Returns 202 with a job id immediately;
 * the pipeline (chunk → graph → LLM generate → audit → embed) runs detached in
 * this process and reports progress to ingest_jobs, which the lab polls via
 * GET /ingest/jobs/:id. Content-type discriminates:
 *   application/json → { title, content, locale?, options? } (paste)
 *   text/markdown | text/plain (raw body) + X-Doc-Title header → (upload)
 * Node-only (LLM + tokenizer deps); the key lives in memory for the job only.
 */
ingestRoute.post("/", async (c) => {
  // The Anthropic key is operator-managed client-side (admin UI localStorage)
  // and arrives per-request — the server keeps no LLM secret at rest. Never log
  // it, never write it to the job row.
  const apiKey = c.req.header("x-anthropic-key");
  if (!apiKey) return c.json({ error: "missing X-Anthropic-Key header" }, 400);

  const ct = c.req.header("content-type") ?? "";
  let input: IngestInput;
  let options: IngestOptions = {};

  if (ct.includes("application/json")) {
    const parsed = v.safeParse(PasteSchema, await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);
    input = {
      title: parsed.output.title,
      content: parsed.output.content,
      mimeType: "text/markdown",
      locale: parsed.output.locale,
    };
    options = parsed.output.options ?? {};
  } else {
    const title = c.req.header("x-doc-title");
    if (!title) return c.json({ error: "missing X-Doc-Title header" }, 400);
    const content = await c.req.text();
    if (!content.trim()) return c.json({ error: "empty body" }, 400);
    input = {
      title,
      content,
      mimeType: ct.includes("text/plain") ? "text/plain" : "text/markdown",
    };
  }

  const jobId = await createJob(input.title);
  runJobDetached(jobId, apiKey, input, options);
  return c.json({ jobId }, 202);
});

/** Recent ingest jobs (newest first) for the lab's job list. */
ingestRoute.get("/jobs", async (c) => {
  return c.json({ jobs: await listJobs() });
});

/** Poll a single job's status + progress. */
ingestRoute.get("/jobs/:id", async (c) => {
  const parsed = v.safeParse(UuidSchema, c.req.param("id"));
  if (!parsed.success) return c.json({ error: "invalid job id" }, 400);
  const job = await getJob(parsed.output);
  if (!job) return c.json({ error: "job not found" }, 404);
  return c.json(job);
});
