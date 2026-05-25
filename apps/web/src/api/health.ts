import type { HealthResponse } from "@simlm/types";

import { apiJson } from "./client";

/**
 * One-shot liveness probe. Not wired into TanStack Query — health is
 * typically consumed by ops dashboards or a manual debug panel, not the
 * React render tree. If a future Phase wants polling, wrap this in
 * useQuery with a short refetchInterval.
 */
export function fetchHealth(): Promise<HealthResponse> {
  return apiJson<HealthResponse>("/healthz");
}
