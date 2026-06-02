import { API_BASE } from "@/lib/env";
import { sessionStore } from "@/store/session";

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

export interface RequestOptions extends RequestInit {
  /**
   * When true, do NOT consume the response body — the caller owns it (e.g.
   * the SSE stream parser). Without this flag, apiFetch will call res.json()
   * on a 4xx/5xx response to surface ApiError, and that consumes the body —
   * a subsequent attempt to read it as a stream throws "body already used."
   */
  raw?: boolean;
}

/**
 * Send a request to the public api, attaching the current session id (if any)
 * and adopting whatever the server echoes back. Always returns the Response —
 * use apiJson() if you want the parsed body. With { raw: true }, error
 * mapping is the caller's responsibility (chat stream relies on this).
 */
export async function apiFetch(path: string, opts: RequestOptions = {}): Promise<Response> {
  const sid = sessionStore.getState().sessionId;
  const headers = new Headers(opts.headers);
  if (sid) headers.set("x-session-id", sid);
  if (opts.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  // The server's withSession middleware echoes X-Session-Id on every
  // response, including the very first request (where the client didn't
  // send one). Adopt unconditionally — if the server reissued because the
  // client's id was malformed or expired, the new one wins.
  const echoed = res.headers.get("x-session-id");
  if (echoed && echoed !== sid) sessionStore.getState().setSessionId(echoed);

  if (!res.ok && !opts.raw) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body, `${res.status} ${res.statusText}`);
  }
  return res;
}

export async function apiJson<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  return (await res.json()) as T;
}
