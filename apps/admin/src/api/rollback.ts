import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/api/client";

export interface RollbackArgs {
  source?: "seed" | "user" | "chat" | "llm";
  topic?: string;
  batch_id?: number;
}

export interface RollbackResult {
  affected: number;
}

/**
 * Bulk soft-delete by filter. Server requires at least one of
 * source/topic/batch_id; the view's "Rollback" button stays disabled
 * client-side until the user fills at least one field. Re-running with
 * the same filter is a no-op (admin-api guards on deleted_at IS NULL),
 * so retries are safe.
 *
 * Invalidates 'pairs' (the rows leave the active list) and 'stats'
 * (counters reflect the deletion). Matches useDeletePair /
 * useRestorePair from Phase 13.
 */
export function useRollback() {
  const qc = useQueryClient();
  return useMutation<RollbackResult, Error, RollbackArgs>({
    mutationFn: (args) =>
      apiJson<RollbackResult>("/rollback", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}
