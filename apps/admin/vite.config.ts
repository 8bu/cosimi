import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

/**
 * Proxy contract:
 *
 *   /api/*  →  http://127.0.0.1:3001  (admin-api, NOT the public api)
 *
 * Why 127.0.0.1 and not localhost: admin-api binds 127.0.0.1 by default
 * as its deployment-level security boundary (see apps/admin-api/src/index.ts
 * loopback warn). Matching the bind exactly preserves that boundary in
 * dev — if a contributor flips ADMIN_HOST to 0.0.0.0 to debug remotely,
 * the proxy still goes through loopback, not through whatever non-loopback
 * interface they opened.
 *
 * Why /api strip mirrors apps/web: admin-api binds routes at the root
 * (/unanswered, /pairs, /teach-queue, /import, /rollback) — no /admin
 * prefix server-side. The SPA uses /api/* as a stable namespace; the
 * production reverse proxy must do the same rewrite.
 *
 * To manage the **portf** product's admin-api instead, launch with:
 *   VITE_ADMIN_API_TARGET=http://127.0.0.1:3011 pnpm --filter @simlm/admin dev
 * Both products are operator-trusted via loopback; same admin SPA, two targets.
 */
const ADMIN_API_TARGET = process.env.VITE_ADMIN_API_TARGET ?? "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: ADMIN_API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
