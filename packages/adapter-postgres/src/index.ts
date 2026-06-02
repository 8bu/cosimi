export { sql, closeDb, runWithRequestDb } from "#client";
export { insertPair, insertManyPairs } from "#repositories/pairs";
export { createBatch, setBatchCount } from "#repositories/import_batches";
export { getAppConfig, setAppConfig } from "#repositories/app_config";
// Re-export the write-path DTO from its canonical home (db-core ports) so
// existing `import { type InsertPairInput } from "@cosimi/adapter-postgres"`
// call sites keep resolving.
export type { InsertPairInput } from "@cosimi/db-core";
