import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminTeachQueueItem } from "@simlm/types";
import { apiJson } from "@/api/client";

export type QueueStatus = "pending" | "approved" | "rejected";

export interface TeachQueueListParams {
  status: QueueStatus;
  flagged?: boolean;
  limit?: number;
  offset?: number;
}

export interface TeachQueueListResponse {
  items: AdminTeachQueueItem[];
  limit: number;
  offset: number;
}

/**
 * URL build uses URLSearchParams (not string concat) — same convention
 * as buildUnansweredUrl. Booleans serialize as "true"/"false" which the
 * admin-api transform schema accepts.
 *
 * Query-key scheme: ['admin', 'teach-queue', { status, flagged?, limit,
 * offset }]. The 'admin' top-level namespace separates these from any
 * shared-with-web keys; the params object is the cache discriminator
 * (status switches get distinct entries). `placeholderData: (prev) =>
 * prev` keeps the table visible across status-tab switches.
 */
export function buildTeachQueueUrl(p: TeachQueueListParams): string {
  const qs = new URLSearchParams();
  qs.set("status", p.status);
  if (p.flagged !== undefined) qs.set("flagged", String(p.flagged));
  qs.set("limit", String(p.limit ?? 50));
  qs.set("offset", String(p.offset ?? 0));
  return `/teach-queue?${qs.toString()}`;
}

export function useTeachQueue(p: TeachQueueListParams) {
  return useQuery({
    queryKey: ["admin", "teach-queue", p],
    queryFn: () => apiJson<TeachQueueListResponse>(buildTeachQueueUrl(p)),
    placeholderData: (prev) => prev,
  });
}

export function useApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiJson<{ pair_id: number }>(`/teach-queue/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      // Prefix-invalidate all teach-queue variants — an approval mutates
      // pending (-1) and approved (+1); both panes need a refetch.
      qc.invalidateQueries({ queryKey: ["admin", "teach-queue"] });
      // The new pair lands in `pairs` — invalidate stats counters too.
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
    },
  });
}

export function useReject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; reviewer_note?: string }) =>
      apiJson<{ ok: true }>(`/teach-queue/${args.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reviewer_note: args.reviewer_note }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "teach-queue"] }),
  });
}

export interface BatchArgs {
  ids: number[];
  action: "approve" | "reject";
  reviewer_note?: string;
}

export function useBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: BatchArgs) =>
      apiJson<{ approved?: number; rejected?: number }>("/teach-queue/batch", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "teach-queue"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
    },
  });
}
