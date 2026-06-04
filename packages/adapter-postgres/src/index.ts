export { sql, closeDb, runWithRequestDb } from "#client";
export {
  insertPair,
  insertManyPairs,
  setPairVector,
  findNearestPairs,
  findPairsByChunks,
  findPairsByStatus,
  setPairStatus,
  updatePairResponse,
  softDeletePair,
  findActivePairsWithoutEmbedding,
} from "#repositories/pairs";
export { createBatch, setBatchCount } from "#repositories/import_batches";
export { getAppConfig, setAppConfig } from "#repositories/app_config";
// Re-export the write-path DTO from its canonical home (db-core ports) so
// existing `import { type InsertPairInput } from "@cosimi/adapter-postgres"`
// call sites keep resolving.
export type { InsertPairInput } from "@cosimi/db-core";
export {
  createDocument,
  findDocumentById,
  listDocuments,
  deleteDocument,
} from "#repositories/documents";
export {
  createChunk,
  createManyChunks,
  findChunkById,
  findChunksByDocument,
  findNearestChunks,
  deleteChunk,
} from "#repositories/chunks";
export { addEdge, getParent, getChildren, getRelated, deleteNode } from "#repositories/graph";
export { mapChunkToPair } from "#repositories/chunk_pair_map";
