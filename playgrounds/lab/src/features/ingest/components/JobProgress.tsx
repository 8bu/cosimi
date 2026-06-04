import { Link } from "@tanstack/react-router";
import { CheckCircle, Spinner, WarningCircle } from "@phosphor-icons/react";
import type { IngestJob } from "@/lib/api/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STAGE_LABEL: Record<string, string> = {
  starting: "Starting…",
  chunking: "Chunking document",
  generating: "Generating Q&A pairs",
  auditing: "Auditing pairs",
  done: "Done",
};

/** Rough 0–100 fill so the bar advances through the pipeline's phases. */
function percent(job: IngestJob): number {
  if (job.status === "done") return 100;
  const frac = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : 0);
  switch (job.stage) {
    case "generating":
      return 10 + 50 * frac(job.chunksDone, job.chunksTotal);
    case "auditing":
      return 60 + 35 * frac(job.pairsAudited, job.pairsGenerated);
    case "done":
      return 100;
    default:
      return 5; // starting / chunking — indeterminate-ish
  }
}

export function JobProgress({ job }: { job: IngestJob }) {
  if (job.status === "error") {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-start gap-3 text-sm">
          <WarningCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Ingest failed</span>
            <span className="text-muted-foreground">{job.error ?? "Unknown error"}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const running = job.status === "running";
  const pct = percent(job);

  return (
    <Card className={job.status === "done" ? "border-emerald-500/40 bg-emerald-500/5" : undefined}>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-2">
          {running ? (
            <Spinner className="size-4 animate-spin text-primary" />
          ) : (
            <CheckCircle weight="fill" className="size-5 text-emerald-500" />
          )}
          <span className="font-medium">
            {job.status === "done" ? "Ingested" : (STAGE_LABEL[job.stage] ?? job.stage)}
          </span>
          <span className="ml-auto truncate text-xs text-muted-foreground">{job.title}</span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Chunks {job.chunksDone}/{job.chunksTotal || "…"}
          </span>
          <span>Generated {job.pairsGenerated}</span>
          <span>
            Audited {job.pairsAudited}/{job.pairsGenerated}
          </span>
          <span className="text-foreground">Passed {job.pairsPassed}</span>
        </div>

        {job.status === "done" && job.documentId && (
          <div>
            <Button asChild variant="outline" size="sm">
              <Link to="/corpus" search={{ doc: job.documentId }}>
                View document
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
