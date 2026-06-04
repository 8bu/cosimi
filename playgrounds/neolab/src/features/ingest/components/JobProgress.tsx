/* Live pipeline card — renders the fixed 6-stage list + overall progress bar
   for a polled IngestJob. Ported from neolab-ref/screen-ingest.jsx (right col). */
import { Icon } from "@/lib/icon";
import { stagesFromJob } from "@/features/ingest/pipeline";
import type { IngestJob } from "@/lib/api/raw-types";

function overallPercent(job: IngestJob | undefined): number {
  if (!job) return 0;
  if (job.status === "done") return 100;
  const stages = stagesFromJob(job);
  const done = stages.filter((s) => s.state === "done").length;
  return Math.round((done / stages.length) * 100);
}

export function JobProgress({ job }: { job: IngestJob | undefined }) {
  const stages = stagesFromJob(job);
  const pct = overallPercent(job);
  const isDone = job?.status === "done";
  const isError = job?.status === "error";
  const isRunning = job?.status === "running";

  const sub = !job
    ? "Idle — ready to run"
    : isDone
      ? "Completed"
      : isError
        ? "Failed"
        : "Processing…";

  return (
    <div className="card">
      <div className="card-head">
        <Icon name="layers" size={17} style={{ color: "var(--accent)" }} />
        <div style={{ flex: 1 }}>
          <div className="card-head-t">Pipeline</div>
          <div className="card-head-sub">{sub}</div>
        </div>
        <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
      <div className="card-body">
        <div className="pbar" style={{ marginBottom: 16 }}>
          <span style={{ width: pct + "%" }} />
        </div>
        <div className="pipe">
          {stages.map((s, i) => (
            <div key={s.key} className={"pstep " + s.state}>
              <div className="pstep-rail">
                <div className="pstep-dot">
                  {s.state === "done" ? <Icon name="check" size={12} /> : i + 1}
                </div>
                <div className="pstep-line" />
              </div>
              <div className="pstep-main">
                <div className="pstep-t">
                  {s.title}
                  {s.state === "active" && (
                    <span className="badge badge-accent">
                      <span className="dot" />
                      live
                    </span>
                  )}
                  {s.state === "failed" && <span className="badge badge-err">failed</span>}
                </div>
                <div className="pstep-d">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {isDone && job && (
          <div className="answer" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="answer-k">
              <Icon name="check" size={13} />
              Indexed successfully
            </div>
            <div className="answer-t" style={{ fontSize: 13 }}>
              {job.chunksDone} chunks and {job.pairsPassed} pairs are now live. The document appears
              in Documents and Corpus.
            </div>
          </div>
        )}

        {isError && job?.error && (
          <div className="answer" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="answer-k" style={{ color: "var(--err)" }}>
              <Icon name="fallback" size={13} />
              Ingestion failed
            </div>
            <div className="answer-t" style={{ fontSize: 13 }}>
              {job.error}
            </div>
          </div>
        )}

        {isRunning && null}
      </div>
    </div>
  );
}
