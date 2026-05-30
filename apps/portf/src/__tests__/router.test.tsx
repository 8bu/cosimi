import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { getRouter } from "@/router";

afterEach(cleanup);

describe("getRouter", () => {
  it("returns a router instance with the generated route tree", () => {
    const router = getRouter();
    expect(router).toBeDefined();
    expect(typeof router.navigate).toBe("function");
    expect(router.routeTree).toBeDefined();
  });
});
