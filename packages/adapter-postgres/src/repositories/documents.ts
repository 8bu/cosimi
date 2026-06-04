import type postgres from "postgres";
import type { Document, NewDocument } from "@cosimi/db-core";
import { sql } from "#client";

type Executor = postgres.Sql | postgres.TransactionSql;

interface Row {
  id: string;
  title: string;
  mime_type: string;
  storage_key: string;
  created_at: Date;
}

const map = (r: Row): Document => ({
  id: r.id,
  title: r.title,
  mimeType: r.mime_type,
  storageKey: r.storage_key,
  createdAt: r.created_at,
});

export async function createDocument(d: NewDocument, tx?: Executor): Promise<Document> {
  const db = tx ?? sql();
  const [row] = await db<Row[]>`
    INSERT INTO documents (title, mime_type, storage_key)
    VALUES (${d.title}, ${d.mimeType}, ${d.storageKey})
    RETURNING *
  `;
  return map(row!);
}

export async function findDocumentById(id: string): Promise<Document | null> {
  const [row] = await sql()<Row[]>`SELECT * FROM documents WHERE id = ${id}`;
  return row ? map(row) : null;
}

export async function listDocuments(): Promise<Document[]> {
  const rows = await sql()<Row[]>`SELECT * FROM documents ORDER BY created_at DESC, id DESC`;
  return rows.map(map);
}

export async function deleteDocument(id: string): Promise<void> {
  await sql()`DELETE FROM documents WHERE id = ${id}`;
}
