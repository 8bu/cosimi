import { useQuery } from "@tanstack/react-query";
import { getIngestJob } from "@/lib/api/admin-client";
import type { IngestJob } from "@/lib/api/raw-types";

/**
 * Poll a single ingest job. Refetches every 1.5s while the job is `running`,
 * stops once it settles to `done`/`error`. Returns the live job row; the route
 * invalidates `["documents"]` on settle (kept in the component for clarity).
 */
export function useIngestJob(jobId: string | null) {
  return useQuery<IngestJob>({
    queryKey: ["ingest-job", jobId],
    queryFn: () => getIngestJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 1500 : false),
  });
}
