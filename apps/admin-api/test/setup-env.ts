// Defensive: re-pin DATABASE_URL inside each worker (globalSetup mutates
// process.env, which propagates to thread workers, but we set it again
// to insulate against vitest pool internals).
const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/simlm";
const url = new URL(base);
url.pathname = "/simlm_test";
process.env.DATABASE_URL = url.toString();
