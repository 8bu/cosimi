/* Session queue — lists jobIds started this session (zustand), each polled.
   There is no list-all endpoint, hence "session jobs only". */
import { Icon } from "@/lib/icon";
import { useIngestStore } from "@/features/ingest/store";
import { useIngestJob } from "@/features/ingest/hooks";
import { stagesFromJob } from "@/features/ingest/pipeline";

function jobPercent(stagesDone: number, total: number, done: boolean): number {
  if (done) return 100;
  return Math.round((stagesDone / total) * 100);
}

function QueueRow({ jobId }: { jobId: string }) {
  const { data: job } = useIngestJob(jobId);
  const stages = stagesFromJob(job);
  const stagesDone = stages.filter((s) => s.state === "done").length;
  const pct = jobPercent(stagesDone, stages.length, job?.status === "done");
  const queued = !job || job.stage === "starting";

  const name = job?.title ?? jobId;
  const stageLabel = !job
    ? "queued"
    : job.status === "done"
      ? "done"
      : job.status === "error"
        ? "error"
        : job.stage;

  return (
    <div className="qrow">
      <div className="pstep-dot" style={{ width: 26, height: 26 }}>
        {queued ? <Icon name="clock" size={13} /> : <Icon name="layers" size={13} />}
      </div>
      <div className="qrow-main">
        <div className="qrow-name">{name}</div>
        <div className="qrow-meta">{stageLabel}</div>
        {pct > 0 && (
          <div className="pbar" style={{ marginTop: 6 }}>
            <span style={{ width: pct + "%" }} />
          </div>
        )}
      </div>
      <span className="num muted" style={{ fontSize: 12 }}>
        {pct}%
      </span>
    </div>
  );
}

export function QueueCard() {
  const jobIds = useIngestStore((s) => s.jobIds);

  return (
    <div className="card">
      <div className="card-head">
        <Icon name="inbox" size={17} style={{ color: "var(--accent)" }} />
        <div style={{ flex: 1 }}>
          <div className="card-head-t">Queue</div>
          <div className="card-head-sub">Session jobs only</div>
        </div>
        <span className="badge">{jobIds.length}</span>
      </div>
      <div className="card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {jobIds.length === 0 ? (
          <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>
            No active jobs.
          </div>
        ) : (
          jobIds.map((id) => <QueueRow key={id} jobId={id} />)
        )}
      </div>
    </div>
  );
}
