// Always re-derive cosimi_test from whatever DATABASE_URL the worker thread
// inherited. globalSetup already prepared the database; this just guarantees
// every test file connects to it (defensive — globalSetup's process.env
// mutation also propagates to thread workers, but we set it again to be safe).
const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cosimi";
const url = new URL(base);
url.pathname = "/cosimi_test";
process.env.DATABASE_URL = url.toString();

// ts_rank with `simple` config typically returns <0.1 for short 2-token queries
// against small docs; production's 0.1 threshold filters those out, but the
// matcher tests need FTS to actually fire on the documented fixtures. Lower
// the floor here so the FTS tier is exercisable. Trigram threshold stays at
// its default (0.4) so the "trigram fires for typos" assertion remains tight.
process.env.MATCH_FTS_MIN = "0.01";
