import { expect, it, vi } from "vitest";
import type { EmbeddingPort } from "@cosimi/core";

vi.mock("../src/lib/embedder", () => ({
  resolveEmbedder: (): EmbeddingPort => ({
    dimension: 1024,
    embed: (t: string[]) => Promise.resolve(t.map(() => Array.from({ length: 1024 }, () => 0))),
  }),
  runWithAi: <T>(_ai: unknown, fn: () => T): T => fn(),
}));

const { app } = await import("../src/app");

it("reports the SDK healthcheck shape { ok, db, schema, issues }", async () => {
  const res = await app.fetch(new Request("http://localhost/healthz"));
  const body = (await res.json()) as {
    ok: boolean;
    db: "up" | "down";
    schema: "ready" | "absent";
    issues: string[];
  };
  expect(body.db).toBe("up");
  expect(["ready", "absent"]).toContain(body.schema);
  expect(Array.isArray(body.issues)).toBe(true);
  expect(body.schema).toBe("ready");
  expect(body.ok).toBe(true);
  expect(res.status).toBe(200);
});
