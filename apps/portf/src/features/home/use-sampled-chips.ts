import { useEffect, useState } from "react";
import { SUGGESTION_CHIPS, sampleChips, type SuggestionChip } from "@/features/home/data";

/**
 * Hydration-safe chip sampling. Returns the deterministic hero prefix
 * (first `n` of the pool) on SSR / first paint, then swaps to a random
 * `n` on mount. The matching first render avoids a hydration mismatch;
 * the post-mount reshuffle is invisible (chips are JS-only interactive).
 */
export function useSampledChips(n = 5): ReadonlyArray<SuggestionChip> {
  const [chips, setChips] = useState<ReadonlyArray<SuggestionChip>>(() =>
    SUGGESTION_CHIPS.slice(0, n),
  );
  useEffect(() => {
    setChips(sampleChips(SUGGESTION_CHIPS, n));
  }, [n]);
  return chips;
}
