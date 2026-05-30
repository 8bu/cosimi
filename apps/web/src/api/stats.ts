import { useQuery } from "@tanstack/react-query";

import type { StatsResponse } from "@cosimi/types";

import { apiJson } from "./client";

/**
 * Drives the chat header's "pairs learned" counter. 30s staleTime +
 * 60s refetchInterval gives the user a near-live count without hammering
 * the api on every render. The server route is index-only and resolves
 * in sub-millisecond, but the visible counter only needs minute-scale
 * freshness.
 */
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => apiJson<StatsResponse>("/stats"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
