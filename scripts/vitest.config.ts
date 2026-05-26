import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// This config exists solely to wire `postgres` into the module graph for
// integration tests in scripts/ — no workspace package owns this directory,
// so pnpm's package-scoped node_modules don't cover it.  We borrow the copy
// that lives in packages/matcher (which has both vitest + postgres).
const matcherModules = resolve(
  import.meta.dirname,
  "../packages/matcher/node_modules"
);

export default defineConfig({
  resolve: {
    alias: {
      postgres: resolve(matcherModules, "postgres/src/index.js"),
    },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
