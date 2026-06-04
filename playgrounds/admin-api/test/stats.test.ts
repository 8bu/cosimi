import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@cosimi/adapter-postgres";

import { app } from "../src/app";
import { getJson, resetDb, seedPairs } from "./helpers";

describe("GET /stats", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns zeroes on an empty store", async () => {
    const res = await getJson(app, "/stats");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      total_active: 0,
      total_deleted: 0,
      total_unanswered: 0,
    });
  });

  it("counts active/deleted/unanswered separately", async () => {
    const ids = await seedPairs([
      { input: "a", response: "1", source: "seed" },
      { input: "b", response: "2", source: "seed" },
    ]);
    await sql()`UPDATE pairs SET deleted_at = NOW() WHERE id = ${ids[0]!}`;
    await sql()`
      INSERT INTO unanswered (input, normalized_input) VALUES ('u', 'u')
    `;

    const res = await getJson(app, "/stats");
    expect(await res.json()).toEqual({
      total_active: 1,
      total_deleted: 1,
      total_unanswered: 1,
    });
  });
});
