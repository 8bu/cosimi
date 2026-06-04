import { defineConfig } from "vitest/config";

// Offline-pipeline DB tests share `cosimi_test` (pgvector schema) and must run
// serially. Pure chunking/token tests are DB-free but ride the same config.
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
