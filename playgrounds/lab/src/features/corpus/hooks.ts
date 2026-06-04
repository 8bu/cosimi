import { useQuery } from "@tanstack/react-query";
import { listDocuments, listChunks, listChunkPairs } from "@/lib/api/admin-client";

export function useCorpusDocuments() {
  return useQuery({ queryKey: ["documents"], queryFn: listDocuments });
}
export function useChunks(documentId: string | null) {
  return useQuery({
    queryKey: ["chunks", documentId],
    queryFn: () => listChunks(documentId!),
    enabled: !!documentId,
  });
}
export function useChunkPairs(chunkId: string | null) {
  return useQuery({
    queryKey: ["chunk-pairs", chunkId],
    queryFn: () => listChunkPairs(chunkId!),
    enabled: !!chunkId,
  });
}
