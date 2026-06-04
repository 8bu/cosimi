const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cosimi";
const url = new URL(base);
url.pathname = "/cosimi_test";
process.env.DATABASE_URL = url.toString();
