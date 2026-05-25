import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { FeedbackRequest, FeedbackResponse } from "@simlm/types";

import { apiJson } from "./client";

/**
 * TanStack Query mutation wrapping POST /feedback.
 *
 * On success we invalidate the `stats` query key because a downvote that
 * crosses PRUNE_SCORE_THRESHOLD soft-deletes the pair and decrements
 * total_pairs_learned. Upvotes don't change the count, but invalidating
 * unconditionally is cheap and keeps the header counter honest.
 */
export function useFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: FeedbackRequest) =>
      apiJson<FeedbackResponse>("/feedback", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
