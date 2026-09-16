/* Maps a real IngestJob onto the fixed 6-stage visual pipeline the prototype
   draws. The backend has fewer stages (starting→chunking→generating→auditing→
   done); we fan `starting` across Fetch+Parse and synthesize per-stage detail
   text from the live counts. Deterministic, pure — unit-tested. */
import type { IngestJob } from "@/lib/api/raw-types";

export type StageState = "pending" | "active" | "done" | "failed";

export interface PipelineStage {
  key: "fetch" | "parse" | "chunk" | "generate" | "audit" | "index";
  title: string;
  state: StageState;
  detail: string;
}

interface StageDef {
  key: PipelineStage["key"];
  title: string;
  idle: string;
}

const STAGES: StageDef[] = [
  { key: "fetch", title: "Fetch & validate", idle: "Resolve & check the source" },
  { key: "parse", title: "Parse & extract", idle: "Strip boilerplate, extract text" },
  { key: "chunk", title: "Chunk & embed", idle: "Split passages, vectorize" },
  { key: "generate", title: "Generate Q/A", idle: "Synthesize question/answer pairs" },
  { key: "audit", title: "Audit", idle: "Verify each pair against its chunk" },
  { key: "index", title: "Index", idle: "Upsert vectors to the knowledge base" },
];

/** The active stage index for a given backend stage string. `starting` spans
   fetch+parse (we mark parse active, fetch already done); `done` is past the
   last index so every stage reads done. */
function activeIndex(stage: string): number {
  switch (stage) {
    case "starting":
      return 1; // parse active, fetch done
    case "chunking":
      return 2;
    case "generating":
      return 3;
    case "auditing":
      return 4;
    case "done":
      return STAGES.length; // all done
    default:
      return 1;
  }
}

function detailFor(key: PipelineStage["key"], job: IngestJob, state: StageState): string {
  const def = STAGES.find((s) => s.key === key)!;
  if (state === "pending") return def.idle;
  switch (key) {
    case "fetch":
      return "Source resolved";
    case "parse":
      return state === "done" ? "Text extracted" : "Extracting text…";
    case "chunk": {
      const total = job.chunksTotal || 0;
      const done = job.chunksDone || 0;
      return total > 0 ? `${done}/${total} chunks` : `${done} chunks`;
    }
    case "generate":
      return `${job.pairsGenerated} pairs`;
    case "audit":
      return `${job.pairsAudited}/${job.pairsGenerated}, ${job.pairsPassed} passed`;
    case "index":
      return state === "done" ? "Vectors upserted" : "Writing vectors…";
    default:
      return def.idle;
  }
}

/**
 * Resolve the fixed visual stage list from a job (or no job → all pending).
 * A stage before the active index = done, the active index = active (or failed
 * when the job errored), after = pending.
 */
export function stagesFromJob(job: IngestJob | undefined): PipelineStage[] {
  if (!job) {
    return STAGES.map((s) => ({ key: s.key, title: s.title, state: "pending", detail: s.idle }));
  }

  if (job.status === "done") {
    return STAGES.map((s) => ({
      key: s.key,
      title: s.title,
      state: "done" as StageState,
      detail: detailFor(s.key, job, "done"),
    }));
  }

  const idx = activeIndex(job.stage);
  const failed = job.status === "error";

  return STAGES.map((s, i): PipelineStage => {
    let state: StageState;
    if (i < idx) state = "done";
    else if (i === idx) state = failed ? "failed" : "active";
    else state = "pending";
    return { key: s.key, title: s.title, state, detail: detailFor(s.key, job, state) };
  });
}
