import { describe, expect, it, vi } from "vitest";

// Mock the matcher so the facade test needs no DB / env: we assert the SDK
// normalizes the query and delegates to matcher.match with the injected sql.
vi.mock("@cosimi/matcher", async (orig) => {
  const actual = await orig<typeof import("@cosimi/matcher")>();
  return { ...actual, match: vi.fn(async () => null) };
});

const { match } = await import("@cosimi/matcher");
const { createCosimi } = await import("../src/index");

const fakeSql = (() => {
  throw new Error("sql must not be invoked — matcher is mocked");
}) as never;

describe("createCosimi", () => {
  it("returns a client exposing match()", () => {
    const client = createCosimi({ sql: fakeSql });
    expect(typeof client.match).toBe("function");
  });

  it("normalizes the query and delegates to matcher.match with the injected sql", async () => {
    const client = createCosimi({ sql: fakeSql });
    await client.match("  Xin CHÀO  ", { sessionId: "s-1", locales: ["vi", "und"] });
    expect(match).toHaveBeenCalledWith(
      fakeSql,
      expect.objectContaining({
        // NFC + lowercase + whitespace-collapsed; diacritics preserved.
        normalizedInput: "xin chào",
        sessionId: "s-1",
        locales: ["vi", "und"],
      }),
    );
  });

  it("defaults sessionId to null when omitted", async () => {
    const client = createCosimi({ sql: fakeSql });
    await client.match("hello");
    expect(match).toHaveBeenLastCalledWith(fakeSql, expect.objectContaining({ sessionId: null }));
  });

  it("forwards custom tiers to the matcher", async () => {
    const tiers = [{ name: "custom", run: async () => null }];
    const client = createCosimi({ sql: fakeSql, tiers });
    await client.match("hi");
    expect(match).toHaveBeenLastCalledWith(fakeSql, expect.objectContaining({ tiers }));
  });
});
