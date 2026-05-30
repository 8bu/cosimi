import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import mdx from "@mdx-js/rollup";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

/**
 * Proxy contract:
 *
 *   /api/*  ->  http://localhost:3010 (path rewritten: /api/foo -> /foo)
 *
 * Plugin order is load-bearing:
 *   tanstackStart (owns route discovery + prerender; replaces TanStackRouterVite)
 *     -> mdx (compiles .mdx -> JSX-bearing ESM; must run before react())
 *       -> viteReact (transforms JSX; babel-based, replaces react-swc)
 *         -> tailwindcss (CSS pipeline; independent)
 */
export default defineConfig({
  plugins: [
    tanstackStart({
      router: {
        routeFileIgnorePattern: "\\.test\\.tsx?$",
      },
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoStaticPathsDiscovery: true,
        failOnError: true,
      },
      sitemap: {
        enabled: true,
        host: "https://8bu.dev",
      },
    }),
    mdx({
      remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }]],
      providerImportSource: "@mdx-js/react",
    }),
    viteReact(),
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
