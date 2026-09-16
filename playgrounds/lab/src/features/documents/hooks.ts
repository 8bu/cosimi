import { useQuery } from "@tanstack/react-query";
import { listDocuments, adminStats } from "@/lib/api/admin-client";
import { corpusStats } from "@/lib/api/retrieve-client";
import { toDocVM } from "@/lib/adapters";
import type { DocVM } from "@/lib/adapters";

export function useDocuments() {
  return useQuery<DocVM[]>({
    queryKey: ["documents"],
    queryFn: async () => (await listDocuments()).map(toDocVM),
  });
}

export interface Totals {
  docs: number;
  chunks: number;
  pairs: number;
  misses: number;
}

/** Sidebar + stat-strip counters: corpus counts (/api/stats) + open misses (/admin/stats). */
export function useStats() {
  return useQuery<Totals>({
    queryKey: ["stats"],
    queryFn: async () => {
      const [corpus, admin] = await Promise.all([corpusStats(), adminStats()]);
      return {
        docs: corpus.documents,
        chunks: corpus.chunks,
        pairs: corpus.pairs,
        misses: admin.total_unanswered,
      };
    },
  });
}
