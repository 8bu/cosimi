import type { StorageRepository } from "@cosimi/db-core";

// Structural subset of aws4fetch's AwsClient — only its signing `fetch`. The
// consumer builds it (`new AwsClient({ accessKeyId, secretAccessKey })`); this
// package neither imports nor bundles aws4fetch (peerDependency) and tests stub it.
export interface SigningClient {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface R2StorageOptions {
  client: SigningClient;
  /** Bucket base URL, e.g. `https://<acct>.r2.cloudflarestorage.com/<bucket>`. */
  bucketUrl: string;
}

/** S3-compatible (R2) StorageRepository. Objects live at `bucketUrl/key`. */
export function createR2Storage(opts: R2StorageOptions): StorageRepository {
  const base = opts.bucketUrl.replace(/\/+$/, "");
  const urlFor = (key: string) => `${base}/${key}`;

  return {
    async upload(file, key, mimeType) {
      const res = await opts.client.fetch(urlFor(key), {
        method: "PUT",
        headers: { "content-type": mimeType },
        body: file,
      });
      if (!res.ok) throw new Error(`r2 upload failed: ${res.status} ${await res.text()}`);
    },
    async download(key) {
      const res = await opts.client.fetch(urlFor(key), { method: "GET" });
      if (!res.ok) throw new Error(`r2 download failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async delete(key) {
      const res = await opts.client.fetch(urlFor(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`r2 delete failed: ${res.status}`);
    },
  };
}
