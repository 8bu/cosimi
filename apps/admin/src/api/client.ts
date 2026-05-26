import { getApiBase } from "@/config/api-base";

/**
 * Why no session-id wiring (unlike apps/web): admin-api doesn't run
 * `withSession` middleware. The whole admin-api process is operator-
 * trusted (loopback bind is the deployment-level boundary), so there are
 * no per-user sessions to thread. Adding an X-Session-Id header here
 * would imply per-user admin auth that doesn't exist server-side; the
 * absence is the contract.
 *
 * Phase 16: the API base is resolved at request time via `getApiBase()`
 * — see `config/api-base.ts`. The build-time `VITE_API_BASE` seeds the
 * synthetic Default preset; everything else flows through the store and
 * is overridable per-tab without a rebuild. Each call is one
 * localStorage read (sub-µs) — no caching layer, intentionally.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiJson<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${getApiBase()}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body, `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
