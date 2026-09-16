import { useQuery } from "@tanstack/react-query";
import { listFallback, type FallbackSource } from "@/lib/api/admin-client";
import { toMissVM } from "@/lib/adapters";
import type { MissVM } from "@/lib/adapters";

export function useFallback(source: FallbackSource = "all") {
  return useQuery<MissVM[]>({
    queryKey: ["fallback", source],
    queryFn: async () => (await listFallback(source)).map(toMissVM),
  });
}
