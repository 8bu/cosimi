import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AdminPair, Source } from "@cosimi/core";
import { apiJson } from "@/api/client";

// Helper: extract a useful error string from the unknown thrown by
// apiJson. ApiError stringifies as `${status} ${statusText}` which is
// good enough for a toast; anything else falls back to Error.message.
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "request failed");

export interface CreatePairBody {
  input: string;
  response: string;
  topic?: string;
}

/**
 * Direct insert into pairs (bypasses teach_queue moderation). Admins are
 * deployment-trusted — the loopback bind is the security boundary, no
 * per-route auth.
 *
 * source: 'user' — the unanswered row originated as a user question; the
 * admin authoring the canonical answer is the "user" of the canonical
 * write path. (Server defaults to 'user' too; explicit here for clarity.)
 *
 * locale: omitted — admin-api's POST /pairs schema doesn't yet accept
 * `locale`, and the row's source locale isn't known here (the unanswered
 * table stores no locale tag). Server falls through to `'und'`
 * (universal) via the GENERATED column default in migration 010, which
 * is what we want: a freshly-taught pair should match cross-locale until
 * an operator deliberately re-tags it. Phase 13's pairs editor will
 * surface a locale field.
 *
 * onSuccess invalidates BOTH 'unanswered' and 'stats' query trees so any
 * dashboard counters reflect the new row.
 */
export function useCreatePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePairBody) =>
      apiJson<{ id: number }>("/pairs", {
        method: "POST",
        body: JSON.stringify({ ...body, source: "user" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "unanswered"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      // Phase 13: a freshly-taught pair also belongs to the /pairs list.
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
      toast.success("Pair created");
    },
    onError: (e) => toast.error(`Create failed — ${errMsg(e)}`),
  });
}

// ---- Phase 13: list / edit / delete / restore --------------------------

export interface PairsListParams {
  source?: Source;
  topic?: string;
  q?: string;
  batch_id?: number;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface PairsListResponse {
  items: AdminPair[];
  limit: number;
  offset: number;
}

/**
 * URL build follows the buildUnansweredUrl convention: URLSearchParams,
 * skip undefined / empty values so the wire shape stays minimal.
 * include_deleted=false is omitted (the admin-api transform schema
 * defaults to false).
 */
export function buildPairsUrl(p: PairsListParams): string {
  const qs = new URLSearchParams();
  if (p.source) qs.set("source", p.source);
  if (p.topic) qs.set("topic", p.topic);
  if (p.q) qs.set("q", p.q);
  if (p.batch_id !== undefined) qs.set("batch_id", String(p.batch_id));
  if (p.include_deleted) qs.set("include_deleted", "true");
  qs.set("limit", String(p.limit ?? 50));
  qs.set("offset", String(p.offset ?? 0));
  return `/pairs?${qs.toString()}`;
}

export function usePairs(p: PairsListParams) {
  return useQuery({
    queryKey: ["admin", "pairs", p],
    queryFn: () => apiJson<PairsListResponse>(buildPairsUrl(p)),
    placeholderData: (prev) => prev,
  });
}

/**
 * Patch body mirrors admin-api's EditSchema: input/response/topic/
 * source/flagged. `locale` is deliberately absent — AdminPair has no
 * locale field, and the PATCH valibot schema doesn't accept it. Phase
 * the locale-edit UX separately if/when product asks.
 */
export interface EditPairBody {
  input?: string;
  response?: string;
  topic?: string;
  source?: Source;
  flagged?: boolean;
}

export function useEditPair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; patch: EditPairBody }) =>
      apiJson<{ ok: true }>(`/pairs/${args.id}`, {
        method: "PATCH",
        body: JSON.stringify(args.patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
      toast.success("Pair updated");
    },
    onError: (e) => toast.error(`Save failed — ${errMsg(e)}`),
  });
}

export function useDeletePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiJson<{ ok: true }>(`/pairs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Pair deleted");
    },
    onError: (e) => toast.error(`Delete failed — ${errMsg(e)}`),
  });
}

export function useRestorePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiJson<{ ok: true }>(`/pairs/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pairs"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Pair restored");
    },
    onError: (e) => toast.error(`Restore failed — ${errMsg(e)}`),
  });
}
