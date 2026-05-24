import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@simlm/db";

import { app } from "../src/app";
import { getJson, resetDb } from "./helpers";

async function seedUnanswered(rows: { input: string; source?: string; count?: number }[]) {
  for (const r of rows) {
    await sql()`
      INSERT INTO unanswered (input, normalized_input, source, count)
      VALUES (${r.input}, ${r.input.toLowerCase()}, ${r.source ?? "chat"}, ${r.count ?? 1})
    `;
  }
}

describe("GET /unanswered", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns rows ordered by count DESC", async () => {
    await seedUnanswered([
      { input: "rare", count: 1 },
      { input: "common", count: 99 },
      { input: "middling", count: 10 },
    ]);
    const res = await getJson(app, "/unanswered");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { input: string; count: number }[] };
    expect(body.items.map((r) => r.input)).toEqual(["common", "middling", "rare"]);
  });

  it("?source=llm filters by source", async () => {
    await seedUnanswered([
      { input: "from-chat", source: "chat", count: 5 },
      { input: "from-llm", source: "llm", count: 3 },
    ]);
    const res = await getJson(app, "/unanswered?source=llm");
    const body = (await res.json()) as { items: { input: string; source: string }[] };
    expect(body.items).toEqual([expect.objectContaining({ input: "from-llm", source: "llm" })]);
  });

  it("paginates via ?limit & ?offset", async () => {
    await seedUnanswered([
      { input: "a", count: 5 },
      { input: "b", count: 4 },
      { input: "c", count: 3 },
    ]);
    const res = await getJson(app, "/unanswered?limit=1&offset=1");
    const body = (await res.json()) as {
      items: { input: string }[];
      limit: number;
      offset: number;
    };
    expect(body.items.length).toBe(1);
    expect(body.items[0]?.input).toBe("b");
    expect(body).toMatchObject({ limit: 1, offset: 1 });
  });
});
