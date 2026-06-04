import type { LLMPort } from "@cosimi/core";
import { GENERATION_SYSTEM, generationUser } from "./prompts";
import { parseGeneration, type GenerationPair } from "./schemas";

/**
 * Ask the generation model for Q&A pairs grounded in `chunkText`. Returns at
 * most `pairsPerChunk` validated pairs; malformed output → [] (caller skips +
 * logs). Pure: no DB, no embedding — the orchestrator does the writes.
 */
export async function generatePairs(
  llm: LLMPort,
  chunkText: string,
  pairsPerChunk: number,
): Promise<GenerationPair[]> {
  const raw = await llm.complete({
    system: GENERATION_SYSTEM,
    user: generationUser(chunkText),
    json: true,
  });
  const parsed = parseGeneration(raw);
  if (!parsed) return [];
  return parsed.slice(0, pairsPerChunk);
}
