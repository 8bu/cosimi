import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { applyMigrations, listMigrationFiles } from "@cosimi/db-core";

const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cosimi";
const url = new URL(base);
url.pathname = "/cosimi_graph_unit";
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";

let db: ReturnType<typeof postgres>;

beforeAll(async () => {
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe("DROP DATABASE IF EXISTS cosimi_graph_unit");
  await admin.unsafe("CREATE DATABASE cosimi_graph_unit");
  await admin.end();
  db = postgres(url.toString(), { max: 1, onnotice: () => {} });
  await applyMigrations(db); // the full sequence — graph schema included, no flag
});

afterAll(async () => {
  // Guard `db` — beforeAll may have thrown before it was assigned. Drop the
  // scratch DB unconditionally so a flaky setup never orphans it.
  await db?.end();
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe("DROP DATABASE IF EXISTS cosimi_graph_unit");
  } finally {
    await admin.end();
  }
});

it("ships the graph/retrieval migrations in the default numbered sequence", async () => {
  const files = await listMigrationFiles();
  expect(files).toContain("012_graph_schema.sql");
  expect(files).toContain("013_ingest_jobs.sql");
});

it("creates the documents, chunks, relation, map and job tables", async () => {
  const rows = await db<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('documents', 'chunks', 'chunk_relations', 'chunk_pair_map', 'ingest_jobs')
    ORDER BY table_name
  `;
  expect(rows.map((r) => r.table_name)).toEqual([
    "chunk_pair_map",
    "chunk_relations",
    "chunks",
    "documents",
    "ingest_jobs",
  ]);
});

it("adds the embedding/audit columns to pairs", async () => {
  const rows = await db<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pairs' AND column_name IN ('embedding', 'audit_status', 'source_chunk')
    ORDER BY column_name
  `;
  expect(rows.map((r) => r.column_name)).toEqual(["audit_status", "embedding", "source_chunk"]);
});
