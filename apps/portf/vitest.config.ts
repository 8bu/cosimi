import { fileURLToPath, URL } from "node:url";
import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vitest/config";

// jsdom + jest-dom matchers + per-test cleanup - mirrors apps/web's setup.
// No tanstackStart here: the Start plugin generates routeTree.gen.ts at
// build/dev time, which we don't need in unit tests (tests render
// components directly or use createMemoryHistory). Including it would
// force tests to depend on the generated tree existing.
//
// mdx() mirrors vite.config.ts so the catalog loader's eager
// `import.meta.glob('../../artifacts/**/*.mdx')` transforms .mdx fixtures
// under tests too.
export default defineConfig({
  plugins: [
    mdx({
      remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }]],
      providerImportSource: "@mdx-js/react",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/lib/test-setup.ts"],
    globals: false,
  },
});
