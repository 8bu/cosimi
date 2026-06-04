import { ADMIN_BASE } from "@/config/bases";
import { getAnthropicKey } from "@/config/anthropic-key";
import type {
  AdminStats,
  ChunkRow,
  CorpusPairRow,
  DocumentRow,
  IngestJob,
  UnansweredRow,
} from "./raw-types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export interface IngestOptions {
  pairsPerChunk?: number;
  reverseCheck?: boolean;
}
export type IngestArgs =
  | { mode: "paste"; title: string; content: string; locale?: string; options?: IngestOptions }
  | { mode: "upload"; file: File; options?: IngestOptions };

/**
 * POST /ingest — ASYNC. Returns { jobId } (202); the pipeline runs detached.
 * Poll with getIngestJob. The Anthropic key is sent via X-Anthropic-Key only.
 */
export async function ingest(args: IngestArgs): Promise<{ jobId: string }> {
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("Set your Anthropic API key first.");
  if (args.mode === "upload") {
    const title = args.file.name.replace(/\.[^.]+$/, "") || "untitled";
    const res = await fetch(`${ADMIN_BASE}/ingest`, {
      method: "POST",
      headers: {
        "content-type": args.file.type || "text/markdown",
        "x-doc-title": title,
        "x-anthropic-key": apiKey,
      },
      body: args.file,
    });
    return jsonOrThrow<{ jobId: string }>(res);
  }
  const res = await fetch(`${ADMIN_BASE}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-anthropic-key": apiKey },
    body: JSON.stringify({
      title: args.title,
      content: args.content,
      locale: args.locale,
      options: args.options,
    }),
  });
  return jsonOrThrow<{ jobId: string }>(res);
}

export async function getIngestJob(id: string): Promise<IngestJob> {
  return jsonOrThrow<IngestJob>(await fetch(`${ADMIN_BASE}/ingest/jobs/${id}`));
}

export async function listDocuments(): Promise<DocumentRow[]> {
  const body = await jsonOrThrow<{ documents: DocumentRow[] }>(
    await fetch(`${ADMIN_BASE}/documents`),
  );
  return body.documents;
}

/** DELETE /documents/:id — purges the document, its chunks, and generated pairs. */
export async function deleteDocument(id: string): Promise<{ ok: true; deletedPairs: number }> {
  return jsonOrThrow(await fetch(`${ADMIN_BASE}/documents/${id}`, { method: "DELETE" }));
}

export async function listChunks(documentId: string): Promise<ChunkRow[]> {
  const body = await jsonOrThrow<{ chunks: ChunkRow[] }>(
    await fetch(`${ADMIN_BASE}/documents/${documentId}/chunks`),
  );
  return body.chunks;
}

export async function listChunkPairs(chunkId: string): Promise<CorpusPairRow[]> {
  const body = await jsonOrThrow<{ pairs: CorpusPairRow[] }>(
    await fetch(`${ADMIN_BASE}/chunks/${chunkId}/pairs`),
  );
  return body.pairs;
}

/** Add a manually authored pair (also clears matching unanswered server-side). */
export async function addPair(input: string, response: string): Promise<{ id: number }> {
  return jsonOrThrow(
    await fetch(`${ADMIN_BASE}/pairs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input, response }),
    }),
  );
}

export type FallbackSource = "chat" | "llm" | "retrieve" | "all";
export async function listFallback(source: FallbackSource = "retrieve"): Promise<UnansweredRow[]> {
  const body = await jsonOrThrow<{ items: UnansweredRow[] }>(
    await fetch(`${ADMIN_BASE}/unanswered?source=${source}`),
  );
  return body.items;
}

export async function adminStats(): Promise<AdminStats> {
  return jsonOrThrow<AdminStats>(await fetch(`${ADMIN_BASE}/stats`));
}
