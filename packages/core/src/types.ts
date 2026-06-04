// A pair's provenance. `llm` = offline-generated; `seed`/`user`/`chat` are
// legacy origins still present on existing rows.
export type Source = "seed" | "user" | "chat" | "llm";

// ─── Legacy chat DTOs — retained ONLY for apps/portf's SimSimi chat UI ──────
// The lexical match path + the api /chat surface are gone (GraphRAG pivot).
// These three survive solely because apps/portf still imports them; remove when
// portf is extracted to its own repo (it will own its chat types + backend).
export type MatchTier = "session_teach" | "exact" | "fts" | "trigram" | "2" | "3";

export interface ChatRequest {
  message: string;
  session_id?: string;
  locales?: string[];
  locale?: string;
}

export type ChatStreamEvent =
  | { type: "session"; session_id: string }
  | {
      type: "metadata";
      tier: MatchTier | null;
      confidence: number | null;
      pairId: number | null;
      score: number | null;
      lowConfidence: boolean;
      locale: string | null;
      topic: string | null;
    }
  | { type: "no_match" }
  | { type: "token"; content: string }
  | { type: "teach_ack"; queue_id: number }
  | { type: "done" }
  | { type: "error"; message: string };

/** Corpus size counters for the api `/stats` endpoint (GraphRAG era). */
export interface StatsResponse {
  documents: number;
  chunks: number;
  /** Active (`deleted_at IS NULL`) pairs that have an embedding. */
  pairs: number;
}

export interface HealthResponse {
  ok: boolean;
  db: "up" | "down";
  db_latency_ms: number | null;
  uptime_s: number;
}

export interface AdminPair {
  id: number;
  input: string;
  normalized_input: string;
  response: string;
  score: number;
  source: Source;
  topic: string | null;
  batch_id: number | null;
  flagged: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUnanswered {
  id: number;
  input: string;
  normalized_input: string;
  source: "chat" | "llm" | "retrieve";
  count: number;
  last_seen: string;
}

// ─── GraphRAG retrieval (runtime, LLM-free) ─────────────────────────────────
// The result of cosimi.retrieve(): ranked chunks (graph-retrieved context),
// each carrying the offline-generated Q&A pairs linked to it. The consumer owns
// the RAG step (feed `content`/`pairs` to their own LLM) — the SDK never
// generates an answer at query time.
/** A chunk returned as context (or as a chunk-hit). `hops` 0 = the matched/source chunk. */
export interface RelatedChunk {
  id: string;
  documentId: string;
  content: string;
  sectionTitle: string | null;
  /** Min graph distance from the matched/source chunk (0 = it). */
  hops: number;
  /** The chunk's own cosine similarity to the query (informational). */
  similarity: number;
}

/** A chunk's linked Q&A pair, briefly (used inside a chunk-hit). */
export interface PairBrief {
  input: string;
  response: string;
  /** Cosine similarity of the pair's embedding to the query. */
  similarity: number;
}

/** The query matched a generated Q&A pair. Its `response` IS the answer; `context` augments. */
export interface PairHit {
  kind: "pair";
  similarity: number;
  input: string;
  response: string;
  /** Source chunk (hops 0) + graph neighbors (≤ maxHops), for downstream context. */
  context: RelatedChunk[];
}

/** The query matched a chunk directly. */
export interface ChunkHit {
  kind: "chunk";
  similarity: number;
  chunk: RelatedChunk;
  pairs: PairBrief[];
}

export type RetrievalHit = PairHit | ChunkHit;

export interface RetrievalResult {
  /** Ranked best-first by similarity; deterministic; [] when nothing clears the floor. */
  hits: RetrievalHit[];
}
