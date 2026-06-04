import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RetrievalResult } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("@/lib/api/retrieve-client", () => ({ retrieve: mocks.retrieve }));
vi.mock("@/config/locale", () => ({ getLocales: () => ["en", "und"] }));

const { useRetrieval } = await import("./store");

beforeEach(() => {
  useRetrieval.setState({
    turns: [],
    isLoading: false,
    tuning: { topK: 8, seedK: 4, maxHops: 2, minSimilarity: 0.5 },
  });
  mocks.retrieve.mockReset();
});
afterEach(() => vi.clearAllMocks());

it("loading → done turn with result", async () => {
  const result: RetrievalResult = { hits: [] };
  mocks.retrieve.mockResolvedValueOnce(result);
  await useRetrieval.getState().submit("q?");
  expect(useRetrieval.getState().turns[0]).toMatchObject({ status: "done", result });
});
it("passes tuning + locales to retrieve", async () => {
  mocks.retrieve.mockResolvedValueOnce({ hits: [] });
  useRetrieval.setState({ tuning: { topK: 3, seedK: 2, maxHops: 1, minSimilarity: 0.7 } });
  await useRetrieval.getState().submit("q");
  expect(mocks.retrieve).toHaveBeenCalledWith(
    "q",
    { topK: 3, seedK: 2, maxHops: 1, minSimilarity: 0.7 },
    ["en", "und"],
  );
});
it("error turn on reject; ignores empty + concurrent", async () => {
  mocks.retrieve.mockRejectedValueOnce(new Error("boom"));
  await useRetrieval.getState().submit("q");
  expect(useRetrieval.getState().turns[0]!.status).toBe("error");
  await useRetrieval.getState().submit("   ");
  expect(useRetrieval.getState().turns).toHaveLength(1);
});
it("setTuning updates one knob", () => {
  useRetrieval.getState().setTuning("topK", 12);
  expect(useRetrieval.getState().tuning.topK).toBe(12);
});
