import { Hono } from "hono";
import * as v from "valibot";

import { createBatch, insertManyPairs, setBatchCount, sql } from "@cosimi/db";
import { normalize } from "@cosimi/normalizer";

const ImportQuerySchema = v.object({
  source: v.picklist(["seed", "llm"] as const),
  topic: v.optional(v.string()),
});

const ImportRowSchema = v.object({
  input: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000)),
  response: v.pipe(v.string(), v.nonEmpty(), v.maxLength(2000)),
  topic: v.optional(v.string()),
});

type ImportRow = v.InferOutput<typeof ImportRowSchema>;

const FLUSH_AT = 500;

export const importRoute = new Hono();

/**
 * Bulk import via JSON array OR JSONL stream. Content-type discriminates:
 *   application/x-ndjson, application/jsonl, text/jsonl → streaming path
 *   application/json (or anything else)                 → buffered path
 *
 * Streaming path flushes every 500 parsed rows via `insertManyPairs` so a
 * 10k-row file never holds more than ~500 rows in memory (acceptance
 * criterion). Each call to the endpoint creates a single `import_batches`
 * row whose id is recorded on every inserted pair — that batch id is the
 * unit of rollback (POST /rollback {batch_id: …}).
 */
importRoute.post("/", async (c) => {
  const queryParsed = v.safeParse(ImportQuerySchema, c.req.query());
  if (!queryParsed.success) return c.json({ error: "invalid query" }, 400);
  const q = queryParsed.output;

  const batchId = await createBatch(q.source, q.topic, "via /import");
  let total = 0;
  // Phase 14 invariant: an imported pair whose normalized form matches a
  // pending `unanswered` row should clear that row, same as the POST
  // /pairs canonical write path's atomic DELETE. We collect normalized
  // inputs across all flushes (the batch array is reset every 500 rows)
  // and DELETE in one shot at the end. Scoped per-import so the seed CLI
  // — which calls insertManyPairs directly through `pnpm seed:vi` — is
  // unaffected (seeds run before any user traffic, so there's nothing to
  // clean). If a future caller wants the cleanup, push it down into
  // `@cosimi/db` then; two call sites isn't the threshold.
  const normalizedSeen = new Set<string>();
  const ct = c.req.header("content-type") ?? "";

  if (ct.includes("ndjson") || ct.includes("jsonl")) {
    const reader = c.req.raw.body?.getReader();
    if (!reader) return c.json({ error: "no body" }, 400);

    const decoder = new TextDecoder();
    let buf = "";
    const batch: ImportRow[] = [];

    const flush = async () => {
      if (!batch.length) return;
      await insertManyPairs(
        batch.map((r) => ({
          input: r.input,
          response: r.response,
          source: q.source,
          topic: q.topic ?? r.topic ?? null,
          batch_id: batchId,
        })),
      );
      total += batch.length;
      batch.length = 0;
    };

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parsed = v.safeParse(ImportRowSchema, JSON.parse(trimmed));
      if (!parsed.success) throw new Error("invalid jsonl row");
      batch.push(parsed.output);
      normalizedSeen.add(normalize(parsed.output.input));
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += decoder.decode(value, { stream: true });
      let nl: number;
      // eslint-disable-next-line no-cond-assign
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        consumeLine(line);
        if (batch.length >= FLUSH_AT) await flush();
      }
      if (done) break;
    }
    // Trailing line without newline
    if (buf.trim()) consumeLine(buf);
    await flush();
  } else {
    const body = await c.req.json().catch(() => null);
    const parsed = v.safeParse(v.array(ImportRowSchema), body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);
    total = await insertManyPairs(
      parsed.output.map((r) => ({
        input: r.input,
        response: r.response,
        source: q.source,
        topic: q.topic ?? r.topic ?? null,
        batch_id: batchId,
      })),
    );
    for (const r of parsed.output) normalizedSeen.add(normalize(r.input));
  }

  // Unanswered cleanup. Single statement, ANY(text[]) keeps the bind
  // count constant regardless of import size.
  if (normalizedSeen.size > 0) {
    const normalizedList = Array.from(normalizedSeen);
    await sql()`DELETE FROM unanswered WHERE normalized_input = ANY(${normalizedList})`;
  }

  await setBatchCount(batchId, total);
  return c.json({ batch_id: batchId, count: total });
});
