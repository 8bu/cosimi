import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

/**
 * Proxy contract:
 *
 *   /api/*  →  http://localhost:3000 (path rewritten: /api/foo → /foo)
 *
 * Why strip /api? apps/api binds public routes at the root (/chat,
 * /feedback, /stats, /healthz). Client code uses /api as a stable
 * namespace so:
 *   - production reverse proxies can route /api/* without touching
 *     non-api routes the SPA may add later (static assets, /auth, etc.)
 *   - the public api process never has to know about an /api prefix
 *     (matches the convention used by apps/admin-api too).
 *
 * Client code calls `fetch('/api/chat', …)`. In dev, Vite proxies. In
 * production, deploy with a reverse proxy that does the same rewrite.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
