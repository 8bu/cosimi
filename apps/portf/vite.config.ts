import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

/**
 * Proxy contract:
 *
 *   /api/*  →  http://localhost:3010 (path rewritten: /api/foo → /foo)
 *
 * The portf product binds its api process on :3010 (vs simlm api on :3000) — see
 * `.env.portf`. Same /api strip convention as apps/web; the production reverse
 * proxy must mirror it.
 *
 * TanStackRouterVite generates `src/routeTree.gen.ts` from files in `src/routes/`
 * on dev/build. The output is gitignored (root .gitignore) but included by
 * tsconfig.json so type-only imports resolve.
 */
export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3010",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
