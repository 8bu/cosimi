import { useQuery } from "@tanstack/react-query";
import { listChunks, listChunkPairs } from "@/lib/api/admin-client";
import { toChunkVM, toPairVM } from "@/lib/adapters";
import type { ChunkVM, PairVM } from "@/lib/adapters";

export function useChunks(docId: string | null) {
  return useQuery<ChunkVM[]>({
    queryKey: ["chunks", docId],
    queryFn: async () => (await listChunks(docId!)).map(toChunkVM),
    enabled: !!docId,
  });
}

export function useChunkPairs(chunkId: string | null) {
  return useQuery<PairVM[]>({
    queryKey: ["chunkPairs", chunkId],
    queryFn: async () => (await listChunkPairs(chunkId!)).map(toPairVM),
    enabled: !!chunkId,
  });
}
