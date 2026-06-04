import { QueryClient } from "@tanstack/react-query";

// Single app-wide client. retry:1 + no refetch-on-focus — a dev lab, not a
// dashboard that needs aggressive freshness.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
