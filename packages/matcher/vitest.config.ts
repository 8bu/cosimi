import { defineConfig } from "vitest/config";

// All matcher tests share a single Postgres test database (`simlm_test`),
// so they must run serially — parallel files would stomp on fixtures.
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
