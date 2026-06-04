import { stagesFromJob } from "@/features/ingest/pipeline";
import type { IngestJob } from "@/lib/api/raw-types";

test("no job → all stages pending", () => {
  const stages = stagesFromJob(undefined);
  expect(stages).toHaveLength(6);
  expect(stages.every((s) => s.state === "pending")).toBe(true);
});

test("chunking stage active mid-run", () => {
  const stages = stagesFromJob({
    stage: "chunking",
    chunksDone: 3,
    chunksTotal: 8,
    status: "running",
    pairsGenerated: 0,
    pairsAudited: 0,
    pairsPassed: 0,
  } as IngestJob);
  const chunk = stages.find((s) => s.key === "chunk")!;
  expect(chunk.state).toBe("active");
  expect(chunk.detail).toContain("3");
  // earlier stages done, later stages pending
  expect(stages.find((s) => s.key === "fetch")!.state).toBe("done");
  expect(stages.find((s) => s.key === "generate")!.state).toBe("pending");
});

test("done → every stage done", () => {
  const stages = stagesFromJob({
    stage: "done",
    status: "done",
    chunksDone: 8,
    chunksTotal: 8,
    pairsGenerated: 5,
    pairsAudited: 5,
    pairsPassed: 4,
  } as IngestJob);
  expect(stages.every((s) => s.state === "done")).toBe(true);
});

test("error marks the active stage failed", () => {
  const stages = stagesFromJob({
    stage: "generating",
    status: "error",
    chunksDone: 8,
    chunksTotal: 8,
    pairsGenerated: 2,
    pairsAudited: 0,
    pairsPassed: 0,
  } as IngestJob);
  expect(stages.find((s) => s.key === "generate")!.state).toBe("failed");
});
