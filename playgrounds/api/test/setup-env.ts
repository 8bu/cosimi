// Defensive: re-pin DATABASE_URL inside each worker (globalSetup mutates
// process.env, which propagates to thread workers, but we set it again
// to insulate against vitest pool internals).
const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cosimi";
const url = new URL(base);
url.pathname = "/cosimi_test";
process.env.DATABASE_URL = url.toString();

// Disable token pacing across the test suite — every chat-handler test
// would otherwise pay 30ms per token, blowing the file timeout.
process.env.SSE_DELAY_BASE_MS = "0";
process.env.SSE_DELAY_JITTER_MS = "0";

// Tests assert on tier/confidence/score in the metadata SSE event. The
// production default is false (fail-closed); flip it on for the suite so
// the asserts hit real values instead of nulls.
process.env.EXPOSE_MATCH_INSIGHTS = "true";
