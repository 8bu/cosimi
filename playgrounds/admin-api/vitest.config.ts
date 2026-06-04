import { defineConfig } from "vitest/config";

// admin-api tests are DB-backed end-to-end against the in-process Hono app.
// Reuse the same `cosimi_test` database as @cosimi/retriever and @cosimi/api;
// run serially because fixtures stomp on each other (one DB, one schema).
export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup-env.ts"],
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
