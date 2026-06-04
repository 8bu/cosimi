export { createCosimi } from "./client";
export type { CosimiClient } from "./client";
export type { CosimiConfig } from "./config";
export type { HealthReport } from "./services/health";
export type { RetrieveInput } from "./services/retrieval";

export type { SqlAccessor } from "@cosimi/retriever";
export type {
  RetrievalResult,
  RetrievalHit,
  PairHit,
  ChunkHit,
  RelatedChunk,
  PairBrief,
} from "@cosimi/core";
