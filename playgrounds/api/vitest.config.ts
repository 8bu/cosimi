import { defineConfig } from "vitest/config";

// Pure-JS unit tests for parsers/tokenizers/SSE shape don't need a DB.
// DB-backed integration tests (teach, feedback, chat orchestration) share
// the same `cosimi_test` database used by @cosimi/retriever and must run
// serially, since fixtures stomp on each other.
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
