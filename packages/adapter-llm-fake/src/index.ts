import type { LLMPort } from "@cosimi/core";

export type LLMResponder = (opts: {
  system: string;
  user: string;
  json?: boolean;
}) => string | Promise<string>;

/**
 * A programmable in-process LLMPort for tests + key-less dev. The `responder`
 * decides what to return per call — return canned JSON to exercise the pipeline's
 * parse/audit paths deterministically.
 */
export function createFakeLLM(responder: LLMResponder): LLMPort {
  return { complete: (opts) => Promise.resolve(responder(opts)) };
}
