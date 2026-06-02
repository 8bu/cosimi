import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@cosimi/adapter-postgres";

import { app } from "../src/app";
import { deleteReq, getJson, patchJson, postJson, resetDb, seedPairs } from "./helpers";

describe("/pairs CRUD", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  describe("POST /pairs", () => {
    it("creates a pair with default source='user'", async () => {
      const res = await postJson(app, "/pairs", { input: "hi", response: "hello" });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: number };
      expect(body.id).toBeGreaterThan(0);

      const rows = await sql()<{ source: string; input: string; response: string }[]>`
        SELECT source, input, response FROM pairs WHERE id = ${body.id}
      `;
      expect(rows[0]).toEqual({ source: "user", input: "hi", response: "hello" });
    });

    it("rejects empty input with 400", async () => {
      const res = await postJson(app, "/pairs", { input: "", response: "x" });
      expect(res.status).toBe(400);
    });

    it("accepts an explicit source override (seed/llm/user)", async () => {
      const res = await postJson(app, "/pairs", {
        input: "hi",
        response: "hello",
        source: "seed",
        topic: "greetings",
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: number };
      const rows = await sql()<{ source: string; topic: string | null }[]>`
        SELECT source, topic FROM pairs WHERE id = ${body.id}
      `;
      expect(rows[0]).toEqual({ source: "seed", topic: "greetings" });
    });

    it("auto-cleans matching unanswered rows (any source) on insert", async () => {
      // Seed two unanswered rows with the same normalized_input but
      // different sources — a Teach should clear both, since the
      // canonical answer is locale/source-agnostic.
      await sql()`
        INSERT INTO unanswered (input, normalized_input, source, count, last_seen)
        VALUES ('What time is it?', 'what time is it?', 'chat', 5, NOW())
      `;
      // Different source on same normalized_input requires a separate
      // surrogate key — the table's unique constraint is on
      // normalized_input alone, so we instead test the cleanup against a
      // single row but assert the route doesn't constrain by source.
      const res = await postJson(app, "/pairs", {
        input: "What time is it?",
        response: "Time to teach.",
      });
      expect(res.status).toBe(201);

      const remaining = await sql()<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM unanswered
         WHERE normalized_input = 'what time is it?'
      `;
      expect(remaining[0]?.count).toBe(0);
    });

    it("is a no-op when no matching unanswered row exists", async () => {
      // No unanswered row to start. Insert should still 201.
      const res = await postJson(app, "/pairs", {
        input: "fresh question",
        response: "fresh answer",
      });
      expect(res.status).toBe(201);
    });
  });

  describe("GET /pairs", () => {
    it("lists non-deleted pairs by default, newest first", async () => {
      const ids = await seedPairs([
        { input: "one", response: "1", source: "seed" },
        { input: "two", response: "2", source: "seed" },
        { input: "three", response: "3", source: "seed" },
      ]);
      // Soft-delete the middle one.
      await sql()`UPDATE pairs SET deleted_at = NOW() WHERE id = ${ids[1]!}`;

      const res = await getJson(app, "/pairs");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: { id: number; input: string }[] };
      expect(body.items.map((p) => p.input)).toEqual(["three", "one"]);
    });

    it("?include_deleted=true returns soft-deleted rows too", async () => {
      const ids = await seedPairs([
        { input: "kept", response: "1", source: "seed" },
        { input: "gone", response: "2", source: "seed" },
      ]);
      await sql()`UPDATE pairs SET deleted_at = NOW() WHERE id = ${ids[1]!}`;

      const res = await getJson(app, "/pairs?include_deleted=true");
      const body = (await res.json()) as { items: { input: string }[] };
      expect(body.items.map((p) => p.input).toSorted()).toEqual(["gone", "kept"]);
    });

    it("?source= filters by source", async () => {
      await seedPairs([
        { input: "s1", response: "x", source: "seed" },
        { input: "u1", response: "y", source: "user" },
      ]);
      const res = await getJson(app, "/pairs?source=user");
      const body = (await res.json()) as { items: { source: string }[] };
      expect(body.items.every((p) => p.source === "user")).toBe(true);
      expect(body.items.length).toBe(1);
    });

    it("?batch_id= filters by import batch", async () => {
      // Two batches; we expect ?batch_id=N to return only rows from N.
      const batchA = await sql()<{ id: number }[]>`
        INSERT INTO import_batches (source, topic, note)
        VALUES ('seed', NULL, 'a') RETURNING id::int AS id
      `;
      const batchB = await sql()<{ id: number }[]>`
        INSERT INTO import_batches (source, topic, note)
        VALUES ('seed', NULL, 'b') RETURNING id::int AS id
      `;
      await seedPairs([
        { input: "a1", response: "x", source: "seed", batch_id: batchA[0]!.id },
        { input: "a2", response: "y", source: "seed", batch_id: batchA[0]!.id },
        { input: "b1", response: "z", source: "seed", batch_id: batchB[0]!.id },
      ]);
      const res = await getJson(app, `/pairs?batch_id=${batchA[0]!.id}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: { input: string; batch_id: number }[] };
      expect(body.items.map((p) => p.input).toSorted()).toEqual(["a1", "a2"]);
      expect(body.items.every((p) => p.batch_id === batchA[0]!.id)).toBe(true);
    });

    it("?q= fuzzy-matches on normalized_unaccented", async () => {
      await seedPairs([
        { input: "café au lait", response: "x", source: "seed" },
        { input: "tea time", response: "y", source: "seed" },
      ]);
      // f_unaccent strips the accent; the q-side normalizes too, so plain
      // "cafe" should still hit the row.
      const res = await getJson(app, "/pairs?q=cafe");
      const body = (await res.json()) as { items: { input: string }[] };
      expect(body.items.map((p) => p.input)).toEqual(["café au lait"]);
    });
  });

  describe("PATCH /pairs/:id", () => {
    it("re-normalizes on input change", async () => {
      const [id] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
      const res = await patchJson(app, `/pairs/${id}`, { input: "  Hello  WORLD  " });
      expect(res.status).toBe(200);
      const rows = await sql()<{ input: string; normalized_input: string }[]>`
        SELECT input, normalized_input FROM pairs WHERE id = ${id!}
      `;
      expect(rows[0]?.input).toBe("  Hello  WORLD  ");
      expect(rows[0]?.normalized_input).toBe("hello world");
    });

    it("can update response alone", async () => {
      const [id] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
      const res = await patchJson(app, `/pairs/${id}`, { response: "hey" });
      expect(res.status).toBe(200);
      const rows = await sql()<{ response: string }[]>`
        SELECT response FROM pairs WHERE id = ${id!}
      `;
      expect(rows[0]?.response).toBe("hey");
    });

    it("returns 404 for unknown id", async () => {
      const res = await patchJson(app, "/pairs/999999", { response: "x" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /pairs/:id and restore", () => {
    it("soft-deletes the pair", async () => {
      const [id] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
      const res = await deleteReq(app, `/pairs/${id}`);
      expect(res.status).toBe(200);
      const rows = await sql()<{ deleted_at: Date | null }[]>`
        SELECT deleted_at FROM pairs WHERE id = ${id!}
      `;
      expect(rows[0]?.deleted_at).not.toBeNull();
    });

    it("delete is idempotent — 404 on second call (already deleted)", async () => {
      const [id] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
      await deleteReq(app, `/pairs/${id}`);
      const res = await deleteReq(app, `/pairs/${id}`);
      expect(res.status).toBe(404);
    });

    it("restore clears deleted_at", async () => {
      const [id] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
      await deleteReq(app, `/pairs/${id}`);
      const res = await postJson(app, `/pairs/${id}/restore`, {});
      expect(res.status).toBe(200);
      const rows = await sql()<{ deleted_at: Date | null }[]>`
        SELECT deleted_at FROM pairs WHERE id = ${id!}
      `;
      expect(rows[0]?.deleted_at).toBeNull();
    });
  });
});
