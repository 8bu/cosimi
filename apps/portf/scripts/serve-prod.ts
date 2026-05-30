import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Local production-mode preview for the SSG'd `apps/portf` build.
 *
 *   - Serves static files from `dist/client/` (1200x630 og PNGs, prerendered
 *     HTML, JS chunks, CSS, favicons, sitemap.xml).
 *   - Proxies `/api/*` to the portf api process on `:3010`
 *     (matches the dev vite proxy contract).
 *   - SPA fallback: `/chat/<anything>` -> `/chat/index.html`
 *     (matches the production host rewrite documented in
 *     `docs/superpowers/specs/2026-05-30-portf-phase-i-tanstack-start-ssg-design.md` §10).
 *
 * This script is for LOCAL prod smoke only - production deploys should use
 * a real reverse proxy (nginx, Cloudflare Workers, Caddy) that honors the
 * same three rules.
 */

const PORT = Number(process.env.PORT ?? 4174);
const API_TARGET_HOST = "localhost";
const API_TARGET_PORT = Number(process.env.PORTF_API_PORT ?? 3010);

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, "..", "..");
const DIST = join(ROOT, "dist", "client");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
};

function resolveStatic(urlPath: string): string | null {
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let target = join(DIST, safe);
  if (!target.startsWith(DIST)) return null;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, "index.html");
  }
  if (!existsSync(target)) return null;
  if (!statSync(target).isFile()) return null;
  return target;
}

function chatFallback(urlPath: string): string | null {
  // SPA-fallback target for /chat/<threadId> direct hits.
  if (!urlPath.startsWith("/chat/")) return null;
  const shell = join(DIST, "chat", "index.html");
  return existsSync(shell) ? shell : null;
}

function notFoundHtml(urlPath: string): string | null {
  const candidate = join(DIST, "404.html");
  if (existsSync(candidate)) return candidate;
  void urlPath;
  return null;
}

const server = createServer((req, res) => {
  const urlPath = (req.url ?? "/").split("?")[0];

  // /api/* -> portf api process
  if (urlPath.startsWith("/api/") || urlPath === "/api") {
    const targetPath = urlPath.replace(/^\/api/, "") || "/";
    const proxyReq = httpRequest(
      {
        host: API_TARGET_HOST,
        port: API_TARGET_PORT,
        method: req.method,
        path: targetPath + (req.url?.includes("?") ? "?" + req.url.split("?")[1] : ""),
        headers: { ...req.headers, host: `${API_TARGET_HOST}:${API_TARGET_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on("error", (err) => {
      console.error(`[serve-prod] proxy error for ${urlPath}:`, err.message);
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`Bad Gateway: portf api on :${API_TARGET_PORT} unreachable`);
    });
    req.pipe(proxyReq);
    return;
  }

  // Static + SPA fallback for /chat/*
  let filepath = resolveStatic(urlPath);
  if (!filepath) filepath = chatFallback(urlPath);
  if (!filepath) {
    const fourOhFour = notFoundHtml(urlPath);
    if (fourOhFour) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      createReadStream(fourOhFour).pipe(res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end(`Not Found: ${urlPath}`);
    return;
  }

  const ext = extname(filepath).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  const stream = createReadStream(filepath);
  stream.on("error", (err) => {
    console.error(`[serve-prod] read error for ${filepath}:`, err.message);
    res.end();
  });
  stream.pipe(res);
});

server.on("clientError", (err, socket) => {
  console.error("[serve-prod] client error:", err.message);
  socket.destroy();
});

server.listen(PORT, () => {
  console.log(`[serve-prod] http://localhost:${PORT}`);
  console.log(`[serve-prod] static root: ${DIST}`);
  console.log(`[serve-prod] /api/* -> http://${API_TARGET_HOST}:${API_TARGET_PORT}`);
  console.log(`[serve-prod] SPA fallback: /chat/* -> /chat/index.html`);
});
