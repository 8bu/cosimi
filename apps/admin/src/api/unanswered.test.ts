import { describe, expect, it } from "vitest";
import { buildUnansweredUrl } from "@/api/unanswered";

// Pure-fn test — no React, no fetch. Covers the URL-shape contract with
// admin-api's QuerySchema (source omitted when 'all'; explicit otherwise).
describe("buildUnansweredUrl", () => {
  it("omits source when 'all' (server defaults to all)", () => {
    expect(buildUnansweredUrl({ source: "all" })).toBe("/unanswered?limit=50&offset=0");
  });

  it("includes source for chat/llm", () => {
    expect(buildUnansweredUrl({ source: "chat" })).toBe(
      "/unanswered?source=chat&limit=50&offset=0",
    );
    expect(buildUnansweredUrl({ source: "llm" })).toBe("/unanswered?source=llm&limit=50&offset=0");
  });

  it("forwards custom limit / offset", () => {
    expect(buildUnansweredUrl({ source: "all", limit: 25, offset: 100 })).toBe(
      "/unanswered?limit=25&offset=100",
    );
  });
});
