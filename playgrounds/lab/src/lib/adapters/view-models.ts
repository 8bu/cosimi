/* Design view-models (prototype §7 shapes). Fields the backend cannot supply are
   nullable; components render `null` scalars as `—` and hide `null`-gated actions. */

export type DocType = "pdf" | "web" | "md" | "txt" | "api";
export type DocStatus = "indexed" | "processing" | "queued" | "failed";

export interface DocVM {
  id: string;
  type: DocType;
  title: string;
  source: string | null;
  status: DocStatus;
  chunks: number;
  pairs: number;
  tokens: number | null;
  added: string;
  by: string | null;
  tags: string[];
  error: string | null;
}

export interface ChunkVM {
  id: string;
  idx: number;
  text: string;
  tokens: number | null;
  pairs: number | null;
  page: number | null;
  heading: string | null;
  embedded: boolean;
}

export interface PairVM {
  id: number | null;
  q: string;
  a: string;
  auditStatus: string | null;
  model: string | null;
  conf: number | null;
}

export type MissSource = "chat" | "llm" | "retrieve";
export interface MissVM {
  id: number;
  query: string;
  count: number;
  lastSeen: string;
  source: MissSource;
}

export interface HitVM {
  rank: number;
  kind: "pair" | "chunk";
  score: number;
  docId: string;
  docTitle: string | null;
  chunkId: string | null;
  text: string;
  page: number | null;
  vec: number | null;
  lex: number | null;
  /** Pair response (PairHit only) → drives the grounded-answer block. */
  answer: string | null;
  neighbors: { id: string; text: string; page: number | null }[];
  pairs: { q: string; a: string }[];
}

export interface RetrieveVM {
  query: string;
  tookMs: number | null;
  hits: HitVM[];
  answer: { text: string; cite: number } | null;
}
