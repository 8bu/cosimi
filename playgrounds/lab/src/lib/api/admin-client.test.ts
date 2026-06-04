import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/config/anthropic-key", () => ({ getAnthropicKey: () => "sk-test" }));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

it("ingest (paste) posts JSON with the anthropic key header", async () => {
  fetchMock.mockResolvedValue(ok({ documentId: "d", chunkCount: 1, relationCount: 0, pairs: {} }));
  const { ingest } = await import("./admin-client");
  await ingest({ mode: "paste", title: "T", content: "body" });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/admin/ingest");
  expect((init.headers as Record<string, string>)["x-anthropic-key"]).toBe("sk-test");
});

it("listFallback hits /admin/unanswered?source=retrieve and unwraps items", async () => {
  fetchMock.mockResolvedValue(
    ok({ items: [{ id: 1, input: "miss", source: "retrieve", count: 2, last_seen: "" }] }),
  );
  const { listFallback } = await import("./admin-client");
  const rows = await listFallback();
  expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/admin/unanswered?source=retrieve");
  expect(rows[0]!.input).toBe("miss");
});

it("listChunks hits the document chunks endpoint", async () => {
  fetchMock.mockResolvedValue(ok({ chunks: [] }));
  const { listChunks } = await import("./admin-client");
  await listChunks("doc1");
  expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/admin/documents/doc1/chunks");
});
