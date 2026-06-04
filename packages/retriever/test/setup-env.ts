// Always re-derive cosimi_test from whatever DATABASE_URL the worker thread
// inherited. globalSetup already prepared the database; this just guarantees
// every test file connects to it (defensive — globalSetup's process.env
// mutation also propagates to thread workers, but we set it again to be safe).
const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cosimi";
const url = new URL(base);
url.pathname = "/cosimi_test";
process.env.DATABASE_URL = url.toString();
