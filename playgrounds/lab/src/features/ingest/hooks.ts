import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getIngestJob, ingest, type IngestArgs } from "@/lib/api/admin-client";

/** Kicks off an async ingest; resolves to { jobId }. Poll it with useIngestJob. */
export function useIngest() {
  return useMutation<{ jobId: string }, Error, IngestArgs>({
    mutationFn: ingest,
    onError: (e) =>
      toast.error(`Ingest failed — ${e instanceof Error ? e.message : "request failed"}`),
  });
}

/** Polls a job every 1.5s while it's running; stops once it settles (done|error). */
export function useIngestJob(jobId: string | null) {
  return useQuery({
    queryKey: ["ingest-job", jobId],
    queryFn: () => getIngestJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 1500 : false),
  });
}
