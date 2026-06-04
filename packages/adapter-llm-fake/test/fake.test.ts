import { expect, it } from "vitest";
import { createFakeLLM } from "../src/index";

it("returns a constant string responder", async () => {
  const llm = createFakeLLM(() => "hi");
  expect(await llm.complete({ system: "s", user: "u" })).toBe("hi");
});

it("passes the call args to the responder", async () => {
  const llm = createFakeLLM((opts) => `${opts.system}|${opts.user}|${opts.json ?? false}`);
  expect(await llm.complete({ system: "S", user: "U", json: true })).toBe("S|U|true");
});

it("supports an async responder", async () => {
  const llm = createFakeLLM(() => Promise.resolve("async-ok"));
  expect(await llm.complete({ system: "s", user: "u" })).toBe("async-ok");
});
