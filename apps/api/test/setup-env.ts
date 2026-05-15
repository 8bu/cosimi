// Defensive: re-pin DATABASE_URL inside each worker (globalSetup mutates
// process.env, which propagates to thread workers, but we set it again
// to insulate against vitest pool internals).
const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/simlm";
const url = new URL(base);
url.pathname = "/simlm_test";
process.env.DATABASE_URL = url.toString();

// Same reasoning as packages/matcher/test/setup-env.ts: FTS over short
// fixture docs falls under the production 0.1 floor. Lower so the FTS
// tier can fire in integration tests.
process.env.MATCH_FTS_MIN = "0.01";

// Disable token pacing across the test suite — every chat-handler test
// would otherwise pay 30ms per token, blowing the file timeout.
process.env.SSE_DELAY_BASE_MS = "0";
process.env.SSE_DELAY_JITTER_MS = "0";
