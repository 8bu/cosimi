import { defineConfig } from "vitest/config";

// Repo tests share the single `cosimi_test` database (now pgvector-enabled),
// so they run serially — parallel files would stomp fixtures.
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
