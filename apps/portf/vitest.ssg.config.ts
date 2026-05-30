import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Node-env SSG build-output assertion config. Isolated from the jsdom
 * unit sweep (vitest.config.ts) for three reasons:
 *
 *   1. The `beforeAll` block runs `pnpm build` end-to-end (~30s wall),
 *      far heavier than any unit test.
 *   2. Assertions inspect real `dist/client/` output; jsdom does not
 *      need it.
 *   3. Test reads MDX descriptors via fs (not via the catalog loader),
 *      so no mdx() plugin is required here.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
