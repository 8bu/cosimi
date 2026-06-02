import { describe, expect, it } from "vitest";

import { stripApiPrefix } from "../src/lib/worker-url";

const url = (path: string) => new Request(`https://8bu.dev${path}`);
const pathOf = (req: Request) => new URL(req.url).pathname;

describe("stripApiPrefix", () => {
  it("strips a leading /api/ segment", () => {
    expect(pathOf(stripApiPrefix(url("/api/chat")))).toBe("/chat");
  });

  it("maps bare /api to /", () => {
    expect(pathOf(stripApiPrefix(url("/api")))).toBe("/");
  });

  it("preserves query string", () => {
    const out = stripApiPrefix(url("/api/stats?window=24"));
    const parsed = new URL(out.url);
    expect(parsed.pathname).toBe("/stats");
    expect(parsed.search).toBe("?window=24");
  });

  it("preserves method and headers", () => {
    const req = new Request("https://8bu.dev/api/chat", {
      method: "POST",
      headers: { "X-Session-Id": "abc" },
    });
    const out = stripApiPrefix(req);
    expect(out.method).toBe("POST");
    expect(out.headers.get("X-Session-Id")).toBe("abc");
  });

  it("does NOT strip a non-/api path", () => {
    expect(pathOf(stripApiPrefix(url("/chat")))).toBe("/chat");
  });

  it("does NOT strip a path that merely starts with 'api'", () => {
    expect(pathOf(stripApiPrefix(url("/apiary")))).toBe("/apiary");
  });
});
