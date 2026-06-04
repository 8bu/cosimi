import type { Source } from "@cosimi/core";

// ─── Write-path DTOs ────────────────────────────────────────────────────────

export interface InsertPairInput {
  input: string;
  response: string;
  source: Source;
  topic?: string | null;
  batch_id?: number | null;
  flagged?: boolean;
  // BCP-47 locale tag. Missing → 'und' (universal); the column has a matching
  // default (migration 010), but routing the default through the helper keeps
  // the JS-side write shape explicit so admin tools / tests don't drop it.
  locale?: string;
}

// ─── Repository ports ───────────────────────────────────────────────────────
//
// Interfaces the concrete adapters implement. `tx` is intentionally `unknown`
// here so the port stays driver-agnostic; the postgres adapter narrows it to
// its own transaction handle. No layer (pipeline, runtime, API handler) should
// touch a driver directly — it goes through one of these.

export interface PairRepository {
  insertPair(p: InsertPairInput, tx?: unknown): Promise<{ id: number }>;
  insertManyPairs(rows: InsertPairInput[], tx?: unknown): Promise<number>;
  /**
   * Vector read: nearest pairs by cosine. `status` defaults to `'pass'`
   * (safe-by-default — the runtime never serves unaudited/rejected pairs); pass
   * an explicit status only for non-serving callers. `locale` defaults to
   * `'und'` (universal pool only); runtime callers pass a concrete locale.
   */
  findNearest(
    embedding: number[],
    limit: number,
    opts?: { status?: AuditStatus; locale?: string },
  ): Promise<ScoredPair[]>;
  /** Graph read: pairs mapped from the given chunk ids, re-ranked by cosine. */
  findByChunks(chunkIds: string[], embedding: number[], limit: number): Promise<ScoredPair[]>;
  /** Pipeline read: pairs in a given audit status (e.g. 'pending' for the audit step). */
  findByStatus(
    status: AuditStatus,
    limit: number,
  ): Promise<{ id: number; input: string; response: string }[]>;
  /** Pipeline write: set the vector + provenance + audit status on a pair after insertPair. */
  setPairVector(
    id: number,
    v: { embedding: number[]; sourceChunk?: string | null; auditStatus?: AuditStatus },
    tx?: unknown,
  ): Promise<void>;
}

export interface BatchRepository {
  createBatch(source: string, tx?: unknown): Promise<{ id: number }>;
  setBatchCount(id: number, count: number, tx?: unknown): Promise<void>;
}

export interface AppConfigRepository {
  getAppConfig(key: string): Promise<string | null>;
  setAppConfig(key: string, value: string): Promise<void>;
}

// ─── Graph / vector retrieval ports ────────────────────────────────────────
// Repository ports for the document-retrieval schema (see docs/ARCHITECTURE.md).

export type RelationType = "PARENT_OF" | "REFERENCES" | "ELABORATES" | "CONTRADICTS";
export type AuditStatus = "pending" | "pass" | "fail" | "rewrite" | "flagged";

export interface StorageRepository {
  upload(file: Uint8Array, key: string, mimeType: string): Promise<void>;
  download(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

// SP2 DTOs (type-only seams). Vector embeddings are `number[]` at the port
// boundary; the postgres adapter maps them to/from pgvector.

export interface Document {
  id: string;
  title: string;
  mimeType: string;
  storageKey: string;
  createdAt: Date;
}
export type NewDocument = Omit<Document, "id" | "createdAt">;

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  sectionTitle: string | null;
  embedding: number[] | null;
  createdAt: Date;
}
export type NewChunk = Omit<Chunk, "id" | "createdAt">;
export interface ScoredChunk extends Chunk {
  /** Cosine similarity to the query embedding, [0, 1]. */
  similarity: number;
}

/** A pair row with its cosine similarity to a query embedding, [0, 1]. */
export interface ScoredPair {
  id: number;
  input: string;
  response: string;
  locale: string;
  similarity: number;
}

export interface DocumentRepository {
  create(doc: NewDocument): Promise<Document>;
  findById(id: string): Promise<Document | null>;
  list(): Promise<Document[]>;
  delete(id: string): Promise<void>;
}

export interface ChunkRepository {
  create(chunk: NewChunk): Promise<Chunk>;
  createMany(chunks: NewChunk[]): Promise<Chunk[]>;
  findById(id: string): Promise<Chunk | null>;
  findByDocument(documentId: string): Promise<Chunk[]>;
  findNearest(embedding: number[], limit: number): Promise<ScoredChunk[]>;
  delete(id: string): Promise<void>;
}

export interface GraphRepository {
  addNode(chunk: Chunk): Promise<void>;
  addEdge(fromId: string, toId: string, type: RelationType): Promise<void>;
  getParent(chunkId: string): Promise<Chunk | null>;
  getChildren(chunkId: string): Promise<Chunk[]>;
  getRelated(chunkId: string, maxHops?: number): Promise<Chunk[]>;
  deleteNode(chunkId: string): Promise<void>;
}
