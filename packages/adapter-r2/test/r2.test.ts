import { expect, it, vi } from "vitest";
import { createR2Storage, type SigningClient } from "../src/index";

function stub(responses: Record<string, Response>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    return responses[key] ?? new Response("not stubbed", { status: 404 });
  });
  const client: SigningClient = { fetch };
  return { client, fetch };
}

const BASE = "https://acct.r2.cloudflarestorage.com/bucket";

it("PUTs bytes to bucketUrl/key with the mime type", async () => {
  const { client, fetch } = stub({
    [`PUT ${BASE}/docs/a.txt`]: new Response(null, { status: 200 }),
  });
  const s = createR2Storage({ client, bucketUrl: BASE });
  await s.upload(new TextEncoder().encode("hi"), "docs/a.txt", "text/plain");
  const [url, init] = fetch.mock.calls[0]!;
  expect(url).toBe(`${BASE}/docs/a.txt`);
  expect(init!.method).toBe("PUT");
  expect((init!.headers as Record<string, string>)["content-type"]).toBe("text/plain");
});

it("downloads bytes via GET", async () => {
  const body = new Uint8Array([1, 2, 3]);
  const { client } = stub({ [`GET ${BASE}/k`]: new Response(body, { status: 200 }) });
  const s = createR2Storage({ client, bucketUrl: BASE });
  expect([...(await s.download("k"))]).toEqual([1, 2, 3]);
});

it("delete issues a DELETE", async () => {
  const { client, fetch } = stub({ [`DELETE ${BASE}/k`]: new Response(null, { status: 204 }) });
  const s = createR2Storage({ client, bucketUrl: BASE });
  await s.delete("k");
  expect(fetch.mock.calls[0]![1]!.method).toBe("DELETE");
});

it("trims a trailing slash on bucketUrl", async () => {
  const { client, fetch } = stub({ [`PUT ${BASE}/k`]: new Response(null, { status: 200 }) });
  const s = createR2Storage({ client, bucketUrl: `${BASE}/` });
  await s.upload(new Uint8Array([1]), "k", "application/octet-stream");
  expect(fetch.mock.calls[0]![0]).toBe(`${BASE}/k`);
});

it("throws on a non-OK upload", async () => {
  const { client } = stub({ [`PUT ${BASE}/k`]: new Response("denied", { status: 403 }) });
  const s = createR2Storage({ client, bucketUrl: BASE });
  await expect(s.upload(new Uint8Array([1]), "k", "x")).rejects.toThrow(/r2 upload failed: 403/);
});
