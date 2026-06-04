import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorage } from "../src/index";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cosimi-storage-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it("uploads then downloads the same bytes", async () => {
  const s = createLocalStorage({ dir });
  const bytes = new TextEncoder().encode("hello world");
  await s.upload(bytes, "docs/a.txt", "text/plain");
  const back = await s.download("docs/a.txt");
  expect(new TextDecoder().decode(back)).toBe("hello world");
});

it("creates nested key directories on upload", async () => {
  const s = createLocalStorage({ dir });
  await s.upload(new Uint8Array([1, 2, 3]), "deep/nested/key.bin", "application/octet-stream");
  const onDisk = await readFile(join(dir, "deep/nested/key.bin"));
  expect([...onDisk]).toEqual([1, 2, 3]);
});

it("delete removes the object", async () => {
  const s = createLocalStorage({ dir });
  await s.upload(new Uint8Array([9]), "x", "application/octet-stream");
  await s.delete("x");
  await expect(s.download("x")).rejects.toThrow();
});

it("delete is idempotent (no throw on missing key)", async () => {
  const s = createLocalStorage({ dir });
  await expect(s.delete("never-existed")).resolves.toBeUndefined();
});

it("rejects keys that escape the base dir", async () => {
  const s = createLocalStorage({ dir });
  await expect(s.upload(new Uint8Array([1]), "../escape", "x")).rejects.toThrow(/invalid key/i);
});
