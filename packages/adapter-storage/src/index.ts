import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { StorageRepository } from "@cosimi/db-core";

export interface LocalStorageOptions {
  /** Base directory; object keys resolve under it. */
  dir: string;
}

/**
 * Filesystem StorageRepository for dev/offline. The object key is a relative
 * path under `dir`. `mimeType` is ignored (the FS has no per-object metadata);
 * the DocumentRepository row is the source of truth for mime type.
 */
export function createLocalStorage(opts: LocalStorageOptions): StorageRepository {
  const base = resolve(opts.dir);

  // Resolve a key under base, refusing any path that escapes it (`..`, abs).
  const pathFor = (key: string): string => {
    const full = resolve(base, key);
    const rel = relative(base, full);
    if (rel.startsWith("..") || resolve(base, rel) !== full) {
      throw new Error(`invalid key (escapes storage dir): ${key}`);
    }
    return full;
  };

  return {
    async upload(file, key) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file);
    },
    async download(key) {
      const buf = await readFile(pathFor(key));
      return new Uint8Array(buf);
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}
