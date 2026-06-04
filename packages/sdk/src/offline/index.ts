// Offline (Node-only) entry point for the SP2 ingest pipeline. Kept on a
// separate subpath so the runtime entry (`@cosimi/sdk`) never drags the
// LLM / tokenizer / embedding offline deps into a Workers bundle.

export { createIngestService } from "./ingest-service";
export type { IngestService } from "./ingest-service";
export { backfillEmbeddings } from "./backfill";
export type { BackfillDeps } from "./backfill";
export type {
  ChunkNode,
  IngestDeps,
  IngestInput,
  IngestOptions,
  IngestProgress,
  IngestResult,
  PipelineLogger,
} from "./types";
