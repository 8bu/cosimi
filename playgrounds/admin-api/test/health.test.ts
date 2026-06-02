import { afterAll, describe, expect, it } from "vitest";

import { closeDb } from "@cosimi/adapter-postgres";

import { app } from "../src/app";
import { getJson } from "./helpers";

describe("GET /healthz", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("reports db: up while postgres is reachable", async () => {
    const res = await getJson(app, "/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; db: string; uptime_s: number };
    expect(body.ok).toBe(true);
    expect(body.db).toBe("up");
    expect(body.uptime_s).toBeGreaterThanOrEqual(0);
  });
});
