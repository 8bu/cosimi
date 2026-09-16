/**
 * Strip a leading `/api` segment from an incoming request URL.
 *
 * The Cloudflare zone Worker route is `<domain>/api/*`, but the Hono app
 * (playgrounds/api/src/app.ts) mounts routes with no `/api` prefix. The worker
 * rewrites the URL before delegating to `app.fetch`. `/api` -> `/`,
 * `/api/retrieve` -> `/retrieve`; anything not under `/api` is returned untouched.
 */
export function stripApiPrefix(req: Request): Request {
  const url = new URL(req.url);
  if (url.pathname === "/api") {
    url.pathname = "/";
    return new Request(url, req);
  }
  if (url.pathname.startsWith("/api/")) {
    url.pathname = url.pathname.slice(4);
    return new Request(url, req);
  }
  return req;
}
