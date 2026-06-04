import type { LLMPort } from "@cosimi/core";
import type { RelationType } from "@cosimi/db-core";
import { RELATION_SYSTEM, relationUser } from "./prompts";
import { parseRelations } from "./schemas";

const TYPE_MAP: Record<string, RelationType> = {
  references: "REFERENCES",
  elaborates: "ELABORATES",
  contradicts: "CONTRADICTS",
};

export interface RelationEdge {
  from: number;
  to: number;
  type: RelationType;
}

/**
 * One LLM pass over a document's chunk contents → cross-reference edges (spec
 * §5 step 3). Skips entirely for <3 chunks. Drops self-edges and out-of-range
 * indices. Index `from`/`to` are positions in `chunkContents` — the orchestrator
 * maps them to chunk ids. Malformed output → [].
 */
export async function extractRelations(
  llm: LLMPort,
  chunkContents: string[],
): Promise<RelationEdge[]> {
  if (chunkContents.length < 3) return [];
  const raw = await llm.complete({
    system: RELATION_SYSTEM,
    user: relationUser(chunkContents),
    json: true,
  });
  const parsed = parseRelations(raw);
  if (!parsed) return [];
  const n = chunkContents.length;
  const edges: RelationEdge[] = [];
  for (const r of parsed) {
    if (r.from < 0 || r.from >= n || r.to < 0 || r.to >= n || r.from === r.to) continue;
    edges.push({ from: r.from, to: r.to, type: TYPE_MAP[r.type]! });
  }
  return edges;
}
