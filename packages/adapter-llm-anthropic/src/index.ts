import type { LLMPort } from "@cosimi/core";

// Structural subset of the @anthropic-ai/sdk client we use — declaring it here
// means this package neither imports nor bundles the SDK (it's a peerDependency
// the consumer injects via `new Anthropic({ apiKey })`), and tests can stub it.
export interface AnthropicLike {
  messages: {
    create(body: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}

export interface AnthropicLLMOptions {
  client: AnthropicLike;
  model: string;
  maxTokens?: number;
}

/**
 * LLMPort over Anthropic's Messages API. One instance per model — the pipeline
 * constructs two (Sonnet for generation/relations, Haiku for audit/reverse).
 * `json` is advisory: Anthropic has no strict JSON mode, so callers instruct
 * JSON via the system prompt and parse the returned text.
 */
export function createAnthropicLLM(opts: AnthropicLLMOptions): LLMPort {
  const maxTokens = opts.maxTokens ?? 4096;
  return {
    async complete({ system, user }) {
      const res = await opts.client.messages.create({
        model: opts.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = res.content
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("");
      if (!text) throw new Error("anthropic: response had no text block");
      return text;
    },
  };
}
