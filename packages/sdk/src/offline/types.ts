import type { EmbeddingPort, LLMPort, Source } from "@cosimi/core";
import type {
  AuditStatus,
  ChunkRepository,
  DocumentRepository,
  GraphRepository,
  PairRepository,
  StorageRepository,
} from "@cosimi/db-core";

/**
 * A node in the chunk forest produced by the chunkers. A node with `children`
 * is a section that exceeded the token-split threshold: it becomes a structural
 * PARENT_OF parent (embedded + graphed, but NOT a pair source — spec §5 step 4),
 * and its children carry the body. A leaf node (no children) is a pair source.
 */
export interface ChunkNode {
  content: string;
  sectionTitle: string | null;
  children?: ChunkNode[];
}

export interface PipelineLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

/**
 * Coarse progress emitted as the pipeline advances, so an async caller (the
 * admin-api ingest job) can stream status to the UI. Counters are cumulative;
 * `stage` names the phase currently running. Best-effort — the orchestrator
 * never blocks on or fails because of a progress callback.
 */
export interface IngestProgress {
  stage: "chunking" | "generating" | "auditing" | "done";
  chunksTotal: number;
  chunksDone: number;
  pairsGenerated: number;
  pairsAudited: number;
  pairsPassed: number;
}

export interface IngestDeps {
  storage: StorageRepository;
  generateLLM: LLMPort; // Sonnet: generation + relations
  auditLLM: LLMPort; // Haiku: audit + reverse
  embedder: EmbeddingPort;
  documents: Pick<DocumentRepository, "create">;
  chunks: Pick<ChunkRepository, "create">;
  graph: Pick<GraphRepository, "addEdge">;
  pairs: Pick<PairRepository, "insertPair" | "setPairVector">;
  mapChunkToPair: (chunkId: string, pairId: number) => Promise<void>;
  setPairStatus: (id: number, status: Exclude<AuditStatus, "fail" | "rewrite">) => Promise<void>;
  updatePairResponse: (id: number, response: string) => Promise<void>;
  softDeletePair: (id: number) => Promise<void>;
  logger?: PipelineLogger;
  /** Best-effort progress sink (e.g. writes to the ingest_jobs row). */
  onProgress?: (p: IngestProgress) => void | Promise<void>;
}

export interface IngestOptions {
  pairsPerChunk?: number; // default 4
  splitThreshold?: number; // tokens, default 600
  chunkSplitThreshold?: number; // cosine, default 0.55
  minSentences?: number; // default 3
  minGenTokens?: number; // default 12 — skip pair-gen on chunks below this (heading/nav fragments)
  reverseCheck?: boolean; // default false
  reverseCheckThreshold?: number; // default 0.75
}

export interface IngestInput {
  title: string;
  content: string | Uint8Array;
  mimeType: string; // 'text/markdown' | 'text/html' | 'text/plain'
  storageKey?: string;
  locale?: string; // default 'und'
  source?: Source; // default 'llm'
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  relationCount: number;
  pairs: { generated: number; pass: number; fail: number; rewrite: number; flagged: number };
}
