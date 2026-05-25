import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/api/client";

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
    },
  });
}
