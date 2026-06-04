import { useQuery } from "@tanstack/react-query";
import { listFallback } from "@/lib/api/admin-client";

export function useFallback() {
  return useQuery({ queryKey: ["fallback"], queryFn: listFallback });
}
