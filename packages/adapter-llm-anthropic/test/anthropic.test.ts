import { expect, it, vi } from "vitest";
import { createAnthropicLLM, type AnthropicLike } from "../src/index";

function stubClient(text: string) {
  const create = vi.fn(async () => ({ content: [{ type: "text", text }] }));
  const client: AnthropicLike = { messages: { create } };
  return { client, create };
}

it("maps system+user to a messages.create call and returns the text block", async () => {
  const { client, create } = stubClient("the reply");
  const llm = createAnthropicLLM({ client, model: "claude-haiku-4-5", maxTokens: 256 });
  const out = await llm.complete({ system: "SYS", user: "USR" });
  expect(out).toBe("the reply");

  expect(create).toHaveBeenCalledTimes(1);
  const arg = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
  expect(arg.model).toBe("claude-haiku-4-5");
  expect(arg.max_tokens).toBe(256);
  expect(arg.system).toBe("SYS");
  expect(arg.messages).toEqual([{ role: "user", content: "USR" }]);
});

it("concatenates multiple text blocks", async () => {
  const create = vi.fn(async () => ({
    content: [
      { type: "text", text: "a" },
      { type: "text", text: "b" },
    ],
  }));
  const llm = createAnthropicLLM({ client: { messages: { create } }, model: "m" });
  expect(await llm.complete({ system: "s", user: "u" })).toBe("ab");
});

it("defaults max_tokens when not provided", async () => {
  const { client, create } = stubClient("x");
  const llm = createAnthropicLLM({ client, model: "m" });
  await llm.complete({ system: "s", user: "u" });
  expect(((create.mock.calls[0] as unknown[])[0] as { max_tokens: number }).max_tokens).toBe(4096);
});

it("throws when the response has no text block", async () => {
  const create = vi.fn(async () => ({ content: [{ type: "tool_use" }] }));
  const llm = createAnthropicLLM({ client: { messages: { create } }, model: "m" });
  await expect(llm.complete({ system: "s", user: "u" })).rejects.toThrow(/no text/i);
});
