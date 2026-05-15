import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@simlm/db";

import { app } from "../src/app";
import { newSessionId, postJson, resetDb, seedPairs } from "./helpers";

describe("POST /feedback", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("accepts a thumbs-up and bumps score by +1", async () => {
    const [pairId] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
    const res = await postJson(app, "/feedback", {
      pair_id: pairId,
      value: 1,
      session_id: newSessionId(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ pair_id: pairId, new_score: 1, was_pruned: false });

    const rows = await sql()<{ score: number }[]>`
      SELECT score FROM pairs WHERE id = ${pairId!}
    `;
    expect(rows[0]?.score).toBe(1);
  });

  it("flips the same session's vote on conflict (one row, not two)", async () => {
    const [pairId] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
    const sessionId = newSessionId();
    await postJson(app, "/feedback", { pair_id: pairId, value: 1, session_id: sessionId });
    await postJson(app, "/feedback", { pair_id: pairId, value: -1, session_id: sessionId });

    const votes = await sql()<{ count: number }[]>`
      SELECT count(*)::int AS count FROM votes WHERE pair_id = ${pairId!}
    `;
    expect(votes[0]?.count).toBe(1);

    const pair = await sql()<{ score: number }[]>`
      SELECT score FROM pairs WHERE id = ${pairId!}
    `;
    expect(pair[0]?.score).toBe(-1);
  });

  it("soft-prunes a pair when score crosses the PRUNE_SCORE_THRESHOLD", async () => {
    const [pairId] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);

    // 4 distinct-session thumbs-downs → score walks -1, -2, -3 (prune
    // fires here, default PRUNE_SCORE_THRESHOLD = -3), then -4. Subsequent
    // votes still update score but don't re-prune (deleted_at stays set
    // and was_pruned is false because the row was already deleted).
    const bodies: { was_pruned?: boolean; new_score?: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await postJson(app, "/feedback", {
        pair_id: pairId,
        value: -1,
        session_id: newSessionId(),
      });
      bodies.push((await res.json()) as { was_pruned?: boolean; new_score?: number });
    }
    expect(bodies.some((b) => b.was_pruned === true)).toBe(true);
    expect(bodies[bodies.length - 1]?.new_score).toBe(-4);

    const rows = await sql()<{ score: number; deleted_at: Date | null }[]>`
      SELECT score, deleted_at FROM pairs WHERE id = ${pairId!}
    `;
    expect(rows[0]?.score).toBe(-4);
    expect(rows[0]?.deleted_at).not.toBeNull();
  });

  it("returns 404 for a non-existent pair", async () => {
    const res = await postJson(app, "/feedback", {
      pair_id: 999_999,
      value: 1,
      session_id: newSessionId(),
    });
    expect(res.status).toBe(404);
  });

  it("rejects invalid value with 400", async () => {
    const [pairId] = await seedPairs([{ input: "hello", response: "hi", source: "seed" }]);
    const res = await postJson(app, "/feedback", {
      pair_id: pairId,
      value: 0,
      session_id: newSessionId(),
    });
    expect(res.status).toBe(400);
  });
});
