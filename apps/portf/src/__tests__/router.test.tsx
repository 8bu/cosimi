import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { createRouter } from "@/router";

afterEach(cleanup);

describe("createRouter", () => {
  it("returns a router instance with the generated route tree", () => {
    const router = createRouter();
    expect(router).toBeDefined();
    expect(typeof router.navigate).toBe("function");
    expect(router.routeTree).toBeDefined();
  });
});
