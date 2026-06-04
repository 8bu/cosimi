import type { EmbeddingPort, LLMPort } from "@cosimi/core";
import { AUDIT_SYSTEM, auditUser, REVERSE_SYSTEM, reverseUser } from "./prompts";
import { parseAudit, parseReverse } from "./schemas";
import { cosineSimilarity } from "./vec";

export type AuditDecision =
  | { action: "pass" }
  | { action: "fail" }
  | { action: "rewrite"; response: string }
  | { action: "skip" };

/**
 * Audit one pair against its source chunk (spec §5 step 5). Returns a decision;
 * the orchestrator applies it. `rewrite` without a `rewritten_answer`, and any
 * malformed output, degrade to `skip` (leave the pair 'pending', warn upstream).
 */
export async function auditPair(
  llm: LLMPort,
  chunkText: string,
  question: string,
  answer: string,
): Promise<AuditDecision> {
  const raw = await llm.complete({
    system: AUDIT_SYSTEM,
    user: auditUser(chunkText, question, answer),
    json: true,
  });
  const verdict = parseAudit(raw);
  if (!verdict) return { action: "skip" };
  if (verdict.verdict === "pass") return { action: "pass" };
  if (verdict.verdict === "fail") return { action: "fail" };
  // rewrite
  if (verdict.rewritten_answer && verdict.rewritten_answer.trim()) {
    return { action: "rewrite", response: verdict.rewritten_answer.trim() };
  }
  return { action: "skip" };
}

/**
 * Reverse check (spec §5 step 6): regenerate a question from the answer, embed
 * it, and flag the pair if that question's cosine to the pair's stored `q: a`
 * vector falls below `threshold`. Empty/failed regeneration → not flagged
 * (can't evaluate). Returns true ⇒ caller sets status 'flagged'.
 */
export async function reverseCheck(
  llm: LLMPort,
  embedder: EmbeddingPort,
  answer: string,
  pairEmbedding: number[],
  threshold: number,
): Promise<boolean> {
  const raw = await llm.complete({ system: REVERSE_SYSTEM, user: reverseUser(answer) });
  const gq = parseReverse(raw);
  if (!gq) return false;
  const [gqEmb] = await embedder.embed([gq]);
  return cosineSimilarity(gqEmb!, pairEmbedding) < threshold;
}
