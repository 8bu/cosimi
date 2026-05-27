import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

/**
 * Proxy contract:
 *
 *   /api/*  →  http://localhost:3010 (path rewritten: /api/foo → /foo)
 *
 * The portf product binds its api process on :3010 (vs simlm api on :3000) — see
 * `.env.portf`. Same /api strip convention as apps/web; the production reverse
 * proxy must mirror it.
 *
 * Plugin order is load-bearing:
 *   TanStackRouterVite (writes routeTree.gen.ts; must run before consumers)
 *     -> mdx (compiles .mdx -> JSX-bearing ESM; must run before react())
 *       -> react (transforms JSX)
 *         -> tailwindcss (CSS pipeline; independent)
 */
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: "\\.test\\.tsx?$",
    }),
    mdx({
      remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }]],
      providerImportSource: "@mdx-js/react",
    }),
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
