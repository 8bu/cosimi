// Offline (Node-only) entry point. SP2 fills this with the document → chunk →
// pair generation/audit pipeline (see docs/NEW_ARCHITECTURE.md "SP2 reference").
// Kept as a separate subpath so the runtime entry (`@cosimi/sdk`) never drags
// LLM / pdf / ollama dependencies into a Workers bundle.
//
// SP1 ships the boundary only.

export interface IngestService {
  // SP2: ingest(document) / runPipeline(documentId) — see NEW_ARCHITECTURE SP2.
  readonly _placeholder?: never;
}
