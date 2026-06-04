// Service-layer ports the SDK consumer injects (mirroring the injected `sql`
// accessor). Provider-agnostic — concrete adapters are separate
// `@cosimi/adapter-embed-*` / `@cosimi/adapter-llm-*` packages. Kept here in
// dep-free core so every layer can reference the interface without a driver dep.

/** A text → vector encoder. `dimension` MUST equal the migration's `vector(N)`. */
export interface EmbeddingPort {
  readonly dimension: number;
  /** Embed a batch; the returned vectors are order-aligned with `texts`. */
  embed(texts: string[]): Promise<number[][]>;
}

/** A generative completion port (offline pipeline only — never the query path). */
export interface LLMPort {
  /** Return the model's text completion. `json: true` requests strict JSON output. */
  complete(opts: { system: string; user: string; json?: boolean }): Promise<string>;
}
