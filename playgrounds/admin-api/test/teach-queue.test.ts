import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@cosimi/adapter-postgres";

import { app } from "../src/app";
import { getJson, postJson, resetDb } from "./helpers";

async function seedQueue(
  rows: { input: string; response: string; topic?: string; flagged?: boolean; status?: string }[],
): Promise<number[]> {
  const ids: number[] = [];
  for (const r of rows) {
    const [row] = await sql()<{ id: number }[]>`
      INSERT INTO teach_queue
        (input, normalized_input, response, topic, submitted_by_session, flagged, status)
      VALUES (
        ${r.input},
        ${r.input.toLowerCase()},
        ${r.response},
        ${r.topic ?? null},
        ${randomUUID()}::uuid,
        ${r.flagged ?? false},
        ${r.status ?? "pending"}
      )
      RETURNING id::int AS id
    `;
    ids.push(row!.id);
  }
  return ids;
}

describe("/teach-queue", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  describe("GET /teach-queue", () => {
    it("lists pending queue items newest first", async () => {
      await seedQueue([
        { input: "older", response: "1" },
        { input: "newer", response: "2" },
      ]);
      const res = await getJson(app, "/teach-queue");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: { input: string }[] };
      expect(body.items.map((r) => r.input)).toEqual(["newer", "older"]);
    });

    it("?status filters by status", async () => {
      await seedQueue([
        { input: "p", response: "1", status: "pending" },
        { input: "a", response: "2", status: "approved" },
      ]);
      const res = await getJson(app, "/teach-queue?status=approved");
      const body = (await res.json()) as { items: { input: string; status: string }[] };
      expect(body.items.length).toBe(1);
      expect(body.items[0]?.input).toBe("a");
    });

    it("?flagged=true filters to flagged items", async () => {
      await seedQueue([
        { input: "clean", response: "x" },
        { input: "dirty", response: "y", flagged: true },
      ]);
      const res = await getJson(app, "/teach-queue?flagged=true");
      const body = (await res.json()) as { items: { input: string }[] };
      expect(body.items.map((r) => r.input)).toEqual(["dirty"]);
    });
  });

  describe("POST /teach-queue/:id/approve", () => {
    it("moves a pending row into pairs and updates the queue atomically", async () => {
      const [id] = await seedQueue([{ input: "hello", response: "hi there" }]);

      const res = await postJson(app, `/teach-queue/${id}/approve`, {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as { pair_id: number };
      expect(body.pair_id).toBeGreaterThan(0);

      const pair = await sql()<{ source: string; input: string; response: string }[]>`
        SELECT source, input, response FROM pairs WHERE id = ${body.pair_id}
      `;
      expect(pair[0]).toEqual({ source: "chat", input: "hello", response: "hi there" });

      const queue = await sql()<{ status: string; pair_id: number | null }[]>`
        SELECT status, pair_id::int AS pair_id FROM teach_queue WHERE id = ${id!}
      `;
      expect(queue[0]?.status).toBe("approved");
      expect(queue[0]?.pair_id).toBe(body.pair_id);
    });

    it("returns 404 for an already-approved or unknown queue row", async () => {
      const [id] = await seedQueue([{ input: "x", response: "y", status: "approved" }]);
      const res = await postJson(app, `/teach-queue/${id}/approve`, {});
      expect(res.status).toBe(404);

      const res2 = await postJson(app, "/teach-queue/999999/approve", {});
      expect(res2.status).toBe(404);
    });
  });

  describe("POST /teach-queue/:id/reject", () => {
    it("marks the row rejected with optional reviewer note", async () => {
      const [id] = await seedQueue([{ input: "spam", response: "ad" }]);
      const res = await postJson(app, `/teach-queue/${id}/reject`, { reviewer_note: "spam" });
      expect(res.status).toBe(200);
      const queue = await sql()<{ status: string; reviewer_note: string | null }[]>`
        SELECT status, reviewer_note FROM teach_queue WHERE id = ${id!}
      `;
      expect(queue[0]).toEqual({ status: "rejected", reviewer_note: "spam" });
    });

    it("returns 404 for already-rejected rows", async () => {
      const [id] = await seedQueue([{ input: "x", response: "y", status: "rejected" }]);
      const res = await postJson(app, `/teach-queue/${id}/reject`, {});
      expect(res.status).toBe(404);
    });
  });

  describe("POST /teach-queue/batch", () => {
    it("bulk approves multiple pending rows atomically", async () => {
      const ids = await seedQueue([
        { input: "a", response: "1" },
        { input: "b", response: "2" },
        { input: "c", response: "3" },
      ]);
      const res = await postJson(app, "/teach-queue/batch", { ids, action: "approve" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { approved: number };
      expect(body.approved).toBe(3);

      const pairs = await sql()<{ count: number }[]>`
        SELECT count(*)::int AS count FROM pairs WHERE source = 'chat'
      `;
      expect(pairs[0]?.count).toBe(3);
    });

    it("bulk rejects with reviewer_note", async () => {
      const ids = await seedQueue([
        { input: "spam1", response: "x" },
        { input: "spam2", response: "y" },
      ]);
      const res = await postJson(app, "/teach-queue/batch", {
        ids,
        action: "reject",
        reviewer_note: "garbage",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { rejected: number };
      expect(body.rejected).toBe(2);

      const rows = await sql()<{ status: string; reviewer_note: string }[]>`
        SELECT status, reviewer_note FROM teach_queue WHERE id = ANY(${ids})
      `;
      expect(rows.every((r) => r.status === "rejected" && r.reviewer_note === "garbage")).toBe(
        true,
      );
    });

    it("rejects empty ids array with 400", async () => {
      const res = await postJson(app, "/teach-queue/batch", { ids: [], action: "approve" });
      expect(res.status).toBe(400);
    });

    it("approve skips non-pending rows (still atomic, no double-promote)", async () => {
      const ids = await seedQueue([
        { input: "approved-already", response: "x", status: "approved" },
        { input: "pending-row", response: "y" },
      ]);
      const res = await postJson(app, "/teach-queue/batch", { ids, action: "approve" });
      const body = (await res.json()) as { approved: number };
      expect(body.approved).toBe(1);

      const pairs = await sql()<{ count: number }[]>`
        SELECT count(*)::int AS count FROM pairs
      `;
      expect(pairs[0]?.count).toBe(1);
    });
  });
});
