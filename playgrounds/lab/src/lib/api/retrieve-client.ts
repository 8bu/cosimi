import { API_BASE } from "@/config/bases";
import type { RetrievalResult, TuningParams } from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/** POST /api/retrieve → deterministic RetrievalResult. `locales` is the pair filter. */
export async function retrieve(
  query: string,
  opts: TuningParams,
  locales: string[],
): Promise<RetrievalResult> {
  const res = await fetch(`${API_BASE}/retrieve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, ...opts, locales }),
  });
  return jsonOrThrow<RetrievalResult>(res);
}

export interface CorpusStats {
  documents: number;
  chunks: number;
  pairs: number;
}
export async function stats(): Promise<CorpusStats> {
  return jsonOrThrow<CorpusStats>(await fetch(`${API_BASE}/stats`));
}
