import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@cosimi/adapter-postgres";

import { app } from "../src/app";
import { postJson, resetDb } from "./helpers";

describe("POST /rollback", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("rolls back only the targeted batch_id", async () => {
    // Create two batches via /import so the rollback path is wired
    // end-to-end with the canonical writer.
    const batchA = (await (
      await postJson(app, "/import?source=seed&topic=a", [
        { input: "a1", response: "x" },
        { input: "a2", response: "y" },
      ])
    ).json()) as { batch_id: number };
    const batchB = (await (
      await postJson(app, "/import?source=seed&topic=b", [{ input: "b1", response: "z" }])
    ).json()) as { batch_id: number };

    const res = await postJson(app, "/rollback", { batch_id: batchA.batch_id });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { affected: number };
    expect(body.affected).toBe(2);

    const active = await sql()<{ topic: string }[]>`
      SELECT topic FROM pairs WHERE deleted_at IS NULL ORDER BY id
    `;
    expect(active.map((r) => r.topic)).toEqual(["b"]);

    // No-op re-run: every targeted row is already deleted.
    const res2 = await postJson(app, "/rollback", { batch_id: batchA.batch_id });
    const body2 = (await res2.json()) as { affected: number };
    expect(body2.affected).toBe(0);
    // Untouched batch survives.
    const stillB = await sql()<{ batch_id: number }[]>`
      SELECT batch_id::int AS batch_id FROM pairs WHERE deleted_at IS NULL
    `;
    expect(stillB.map((r) => r.batch_id)).toEqual([batchB.batch_id]);
  });

  it("rolls back by source", async () => {
    await postJson(app, "/import?source=seed", [{ input: "s", response: "x" }]);
    await postJson(app, "/import?source=llm", [{ input: "l", response: "y" }]);

    const res = await postJson(app, "/rollback", { source: "llm" });
    const body = (await res.json()) as { affected: number };
    expect(body.affected).toBe(1);

    const survivors = await sql()<{ source: string }[]>`
      SELECT source FROM pairs WHERE deleted_at IS NULL
    `;
    expect(survivors).toEqual([{ source: "seed" }]);
  });

  it("rolls back by topic", async () => {
    await postJson(app, "/import?source=seed&topic=keep", [{ input: "1", response: "a" }]);
    await postJson(app, "/import?source=seed&topic=drop", [{ input: "2", response: "b" }]);

    const res = await postJson(app, "/rollback", { topic: "drop" });
    const body = (await res.json()) as { affected: number };
    expect(body.affected).toBe(1);
  });

  it("400 on empty body (no source/topic/batch_id)", async () => {
    const res = await postJson(app, "/rollback", {});
    expect(res.status).toBe(400);
  });

  it("400 when body is unparseable", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
