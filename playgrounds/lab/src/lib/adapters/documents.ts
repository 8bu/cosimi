import type { ChunkRow, CorpusPairRow, DocumentRow } from "@/lib/api/raw-types";
import type { ChunkVM, DocType, DocVM, PairVM } from "./view-models";

/** Derive the design doctype glyph from a mime type. */
export function mimeToType(mime: string): DocType {
  const m = mime.toLowerCase();
  if (m.includes("markdown")) return "md";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("html")) return "web";
  if (m.includes("json") || m.includes("yaml") || m.includes("yml")) return "api";
  if (m.includes("plain")) return "txt";
  return "txt";
}

/** Existing docs (those with chunks) are indexed; status/processing live in jobs. */
export function toDocVM(row: DocumentRow): DocVM {
  return {
    id: row.id,
    type: mimeToType(row.mime_type),
    title: row.title,
    source: null,
    status: "indexed",
    chunks: row.chunkCount,
    pairs: row.pairCount,
    tokens: null,
    added: row.created_at,
    by: null,
    tags: [],
    error: null,
  };
}

export function toChunkVM(row: ChunkRow): ChunkVM {
  return {
    id: row.id,
    idx: row.chunk_index,
    text: row.content,
    tokens: null,
    pairs: null,
    page: null,
    heading: row.section_title,
    embedded: row.has_embedding,
  };
}

export function toPairVM(row: CorpusPairRow): PairVM {
  return {
    id: row.id,
    q: row.input,
    a: row.response,
    auditStatus: row.audit_status,
    model: null,
    conf: null,
  };
}
