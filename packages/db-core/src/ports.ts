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
}

export interface BatchRepository {
  createBatch(source: string, tx?: unknown): Promise<{ id: number }>;
  setBatchCount(id: number, count: number, tx?: unknown): Promise<void>;
}

export interface AppConfigRepository {
  getAppConfig(key: string): Promise<string | null>;
  setAppConfig(key: string, value: string): Promise<void>;
}

// ─── Tier 2/3 seams (SP2) ─────────────────────────────────────────────────
// Type-only placeholders. Filled with full signatures + concrete adapters in
// SP2 (see docs/NEW_ARCHITECTURE.md). No implementation in SP1.

export type RelationType = "PARENT_OF" | "REFERENCES" | "ELABORATES" | "CONTRADICTS";
export type AuditStatus = "pending" | "pass" | "fail" | "rewrite" | "flagged";

export interface StorageRepository {
  upload(file: Uint8Array, key: string, mimeType: string): Promise<void>;
  download(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

export interface DocumentRepository {
  // SP2: create / findById / list / delete
  [method: string]: unknown;
}

export interface ChunkRepository {
  // SP2: create / createMany / findById / findByDocument / findNearest / delete
  [method: string]: unknown;
}

export interface GraphRepository {
  // SP2: addNode / addEdge / getParent / getChildren / getRelated / deleteNode
  [method: string]: unknown;
}
