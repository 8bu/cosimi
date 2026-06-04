import { expect, it, vi } from "vitest";
import { createOllamaEmbedder } from "../src/index";

function stubFetch(embeddings: number[][]) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ embeddings }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

it("posts model + input array to /api/embed and maps embeddings", async () => {
  const fetchImpl = stubFetch([
    [1, 2, 3],
    [4, 5, 6],
  ]);
  const e = createOllamaEmbedder({
    baseUrl: "http://localhost:11434",
    dimension: 3,
    fetch: fetchImpl,
  });
  const out = await e.embed(["a", "b"]);
  expect(out).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);

  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  const [url, init] = call;
  expect(url).toBe("http://localhost:11434/api/embed");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual({ model: "bge-m3", input: ["a", "b"] });
});

it("defaults dimension to 1024 and model to bge-m3", () => {
  const e = createOllamaEmbedder({ baseUrl: "http://x", fetch: stubFetch([]) });
  expect(e.dimension).toBe(1024);
});

it("trims a trailing slash on baseUrl", async () => {
  const fetchImpl = stubFetch([[1]]);
  const e = createOllamaEmbedder({
    baseUrl: "http://localhost:11434/",
    dimension: 1,
    fetch: fetchImpl,
  });
  await e.embed(["a"]);
  expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
    "http://localhost:11434/api/embed",
  );
});

it("throws on a non-OK response", async () => {
  const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
  const e = createOllamaEmbedder({ baseUrl: "http://x", fetch: fetchImpl });
  await expect(e.embed(["a"])).rejects.toThrow(/ollama embed failed: 500/);
});

it("returns [] for an empty batch without calling fetch", async () => {
  const fetchImpl = stubFetch([]);
  const e = createOllamaEmbedder({ baseUrl: "http://x", fetch: fetchImpl });
  expect(await e.embed([])).toEqual([]);
  expect(fetchImpl).not.toHaveBeenCalled();
});
