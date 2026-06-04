/* Raw backend DTOs — exactly what the admin/retrieve APIs return. Adapters
   (src/lib/adapters/) map these to design view-models. */
export type {
  RetrievalResult,
  RetrievalHit,
  PairHit,
  ChunkHit,
  RelatedChunk,
  PairBrief,
} from "@cosimi/core";

export interface TuningParams {
  topK: number;
  seedK: number;
  maxHops: number;
  minSimilarity: number;
}

/** Async ingest job — POST /ingest returns { jobId }; poll GET /ingest/jobs/:id. */
export interface IngestJob {
  id: string;
  title: string;
  status: "running" | "done" | "error";
  stage: "starting" | "chunking" | "generating" | "auditing" | "done" | string;
  chunksTotal: number;
  chunksDone: number;
  pairsGenerated: number;
  pairsAudited: number;
  pairsPassed: number;
  documentId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  mime_type: string;
  created_at: string;
  chunkCount: number;
  pairCount: number;
}

export interface ChunkRow {
  id: string;
  chunk_index: number;
  section_title: string | null;
  content: string;
  has_embedding: boolean;
}

export interface CorpusPairRow {
  id: number;
  input: string;
  response: string;
  audit_status: string;
  has_embedding: boolean;
}

export interface UnansweredRow {
  id: number;
  input: string;
  normalized_input: string;
  source: "chat" | "llm" | "retrieve";
  count: number;
  last_seen: string;
}

export interface AdminStats {
  total_active: number;
  total_deleted: number;
  total_unanswered: number;
}

export interface CorpusStats {
  documents: number;
  chunks: number;
  pairs: number;
}
