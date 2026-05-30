import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { FeedbackRequest, FeedbackResponse } from "@cosimi/types";

import { translate } from "@/lib/i18n";
import { preferencesStore } from "@/store/preferences";

import { apiJson } from "./client";

/**
 * TanStack Query mutation wrapping POST /feedback.
 *
 * On success we invalidate the `stats` query key because a downvote that
 * crosses PRUNE_SCORE_THRESHOLD soft-deletes the pair and decrements
 * total_pairs_learned. Upvotes don't change the count, but invalidating
 * unconditionally is cheap and keeps the header counter honest.
 *
 * On error we toast a localized message. VoteButtons already reverts
 * the optimistic UI in its own onError handler — this toast surfaces
 * that the click was lost, since the in-message chrome alone doesn't
 * communicate failure (the button just snaps back).
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
    onError: () => {
      const locale = preferencesStore.getState().primaryLocale;
      toast.error(translate(locale, "error.feedback"));
    },
  });
}
