import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@simlm/db";

import { app } from "../src/app";
import { getJson, resetDb, seedPairs } from "./helpers";

describe("GET /stats", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns total_pairs_learned = 0 for an empty store", async () => {
    const res = await getJson(app, "/stats");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total_pairs_learned: 0 });
  });

  it("counts only non-deleted pairs", async () => {
    const ids = await seedPairs([
      { input: "a", response: "1", source: "seed" },
      { input: "b", response: "2", source: "seed" },
      { input: "c", response: "3", source: "seed" },
    ]);
    // Soft-delete one.
    await sql()`UPDATE pairs SET deleted_at = NOW() WHERE id = ${ids[0]!}`;

    const res = await getJson(app, "/stats");
    expect(await res.json()).toEqual({ total_pairs_learned: 2 });
  });
});

describe("GET /healthz", () => {
  it("reports db: up while postgres is reachable", async () => {
    const res = await getJson(app, "/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; db: string; uptime_s: number };
    expect(body.ok).toBe(true);
    expect(body.db).toBe("up");
    expect(body.uptime_s).toBeGreaterThanOrEqual(0);
  });
});
