import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiBase } from "@/config/api-base";

export interface ImportArgs {
  file: File;
  source: "seed" | "llm";
  topic?: string;
}

export interface ImportResult {
  batch_id: number;
  count: number;
}

/**
 * Plain fetch (NOT apiJson) because the body is a File and the
 * content-type header discriminates server-side between the streaming
 * JSONL path (application/x-ndjson) and the buffered JSON-array path
 * (application/json). apiJson always sets content-type: application/json
 * and stringifies the body, which would break both paths — don't "DRY
 * it up" through apiJson.
 *
 * onSuccess invalidates three trees: 'pairs' (the new rows belong
 * there), 'stats' (any dashboard counters reflect the new corpus size),
 * and 'unanswered' (Phase 14 invariant: import clears matching
 * unanswered rows server-side — the moderation queue must refetch).
 */
export function useImport() {
  const qc = useQueryClient();
  return useMutation<ImportResult, Error, ImportArgs>({
    mutationFn: async ({ file, source, topic }) => {
      const qs = new URLSearchParams({ source });
      if (topic) qs.set("topic", topic);
      const lower = file.name.toLowerCase();
      const isJsonl = lower.endsWith(".jsonl") || lower.endsWith(".ndjson");
      const res = await fetch(`${getApiBase()}/import?${qs.toString()}`, {
        method: "POST",
        headers: { "content-type": isJsonl ? "application/x-ndjson" : "application/json" },
        body: file,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `import failed: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as ImportResult;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "unanswered"] });
      // The view also renders an inline success card (with a "View
      // rows" link to the batch-filtered pairs page); the toast is the
      // peripheral notice in case the operator already scrolled the
      // form off-screen during a multi-MB import.
      toast.success(`Imported ${data.count} pairs (batch #${data.batch_id})`);
    },
    onError: (e) =>
      toast.error(`Import failed — ${e instanceof Error ? e.message : "request failed"}`),
  });
}
