import { describe, expect, it } from "vitest";
import { formatRelativeTs } from "@/lib/formatRelativeTs";

describe("formatRelativeTs", () => {
  const now = 1_000_000_000_000;

  it("renders 'now' for < 60s", () => {
    expect(formatRelativeTs(now - 30_000, now)).toBe("now");
  });

  it("renders minutes", () => {
    expect(formatRelativeTs(now - 5 * 60_000, now)).toBe("5m");
  });

  it("renders hours", () => {
    expect(formatRelativeTs(now - 3 * 3_600_000, now)).toBe("3h");
  });

  it("renders days", () => {
    expect(formatRelativeTs(now - 2 * 86_400_000, now)).toBe("2d");
  });
});
