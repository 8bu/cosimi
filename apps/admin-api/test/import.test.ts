import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@simlm/db";

import { app } from "../src/app";
import { postJson, postRaw, resetDb } from "./helpers";

describe("POST /import", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("imports a JSON array of rows under one batch_id", async () => {
    const res = await postJson(app, "/import?source=seed&topic=greetings", [
      { input: "hi", response: "hello" },
      { input: "yo", response: "what's up" },
    ]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { batch_id: number; count: number };
    expect(body.count).toBe(2);
    expect(body.batch_id).toBeGreaterThan(0);

    const rows = await sql()<{ source: string; topic: string; batch_id: number }[]>`
      SELECT source, topic, batch_id::int AS batch_id FROM pairs ORDER BY id
    `;
    expect(rows).toEqual([
      { source: "seed", topic: "greetings", batch_id: body.batch_id },
      { source: "seed", topic: "greetings", batch_id: body.batch_id },
    ]);

    const batch = await sql()<{ count: number; source: string; topic: string }[]>`
      SELECT count, source, topic FROM import_batches WHERE id = ${body.batch_id}
    `;
    expect(batch[0]).toEqual({ count: 2, source: "seed", topic: "greetings" });
  });

  it("imports JSONL via streaming content-type, flushing in batches", async () => {
    // 1200 rows exercises >2 internal flushes (FLUSH_AT=500). We want to
    // confirm the rows actually land — exhaustive OOM testing belongs in
    // a load test, not a unit test, but this proves correctness of the
    // line-by-line parser and the multi-batch flush logic.
    const lines: string[] = [];
    for (let i = 0; i < 1200; i++) {
      lines.push(JSON.stringify({ input: `q${i}`, response: `a${i}` }));
    }
    const body = lines.join("\n");

    const res = await postRaw(app, "/import?source=llm", body, {
      "content-type": "application/x-ndjson",
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { count: number };
    expect(json.count).toBe(1200);

    const rows = await sql()<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pairs WHERE source = 'llm'
    `;
    expect(rows[0]?.count).toBe(1200);
  });

  it("falls back to JSON parsing when content-type is application/json", async () => {
    const res = await postJson(app, "/import?source=seed", [{ input: "single", response: "row" }]);
    expect(res.status).toBe(200);
  });

  it("rejects when source query param is missing or invalid", async () => {
    const res = await postJson(app, "/import", []);
    expect(res.status).toBe(400);

    const res2 = await postJson(app, "/import?source=user", []);
    expect(res2.status).toBe(400);
  });
});
