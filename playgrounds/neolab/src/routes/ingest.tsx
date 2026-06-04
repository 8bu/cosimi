import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHead } from "@/components/shell/PageHead";
import { ingest, type IngestArgs } from "@/lib/api/admin-client";
import { useIngestStore } from "@/features/ingest/store";
import { useIngestJob } from "@/features/ingest/hooks";
import { IngestForm } from "@/features/ingest/components/IngestForm";
import { JobProgress } from "@/features/ingest/components/JobProgress";
import { QueueCard } from "@/features/ingest/components/QueueCard";

function IngestPage() {
  const queryClient = useQueryClient();
  const addJob = useIngestStore((s) => s.addJob);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { data: job } = useIngestJob(activeJobId);
  const settled = useRef<string | null>(null);

  const status = job?.status;
  const running = status === "running";
  const done = status === "done";

  // Fire once per job when it settles: refresh the document list / toast.
  useEffect(() => {
    if (!job || settled.current === job.id) return;
    if (job.status === "done") {
      settled.current = job.id;
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`Ingested — ${job.chunksDone} chunks, ${job.pairsPassed} pairs live.`);
    } else if (job.status === "error") {
      settled.current = job.id;
      toast.error(job.error ?? "Ingestion failed.");
    }
  }, [job, queryClient]);

  async function handleStart(args: IngestArgs) {
    try {
      const { jobId } = await ingest(args);
      addJob(jobId);
      setActiveJobId(jobId);
      settled.current = null;
      toast.info("Ingestion started.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start ingestion.");
    }
  }

  function handleReset() {
    setActiveJobId(null);
    settled.current = null;
  }

  return (
    <div className="scroll">
      <div className="page">
        <PageHead
          kicker="Manage / Ingest"
          title="Ingest a source"
          sub="Add a document to the knowledge base. The SDK chunks, embeds, generates Q/A pairs, and audits — watch the pipeline run end-to-end."
        />

        <div className="ingest-grid">
          <IngestForm onStart={handleStart} running={running} done={done} onReset={handleReset} />

          <div className="col" style={{ gap: 22 }}>
            <JobProgress job={job} />
            <QueueCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/ingest")({ component: IngestPage });
