import { useQuery } from "@tanstack/react-query";
import type { AdminUnanswered } from "@cosimi/types";
import { apiJson } from "@/api/client";

export type UnansweredSource = "all" | "chat" | "llm";

export interface UnansweredListParams {
  source: UnansweredSource;
  limit?: number;
  offset?: number;
}

export interface UnansweredListResponse {
  items: AdminUnanswered[];
  limit: number;
  offset: number;
}

/**
 * Query-key scheme: ['admin', 'unanswered', { source, limit, offset }].
 * The 'admin' top-level namespace separates these from any future
 * shared-with-web keys; the params object is the cache discriminator
 * so source/page changes get distinct entries (and `placeholderData:
 * (prev) => prev` keeps the table populated through tab switches).
 *
 * URL build uses URLSearchParams: 'all' is omitted entirely (admin-api's
 * QuerySchema defaults to 'all' when absent, so the wire is shorter).
 * 'chat'/'llm' go in explicitly.
 */
export function buildUnansweredUrl(params: UnansweredListParams): string {
  const qs = new URLSearchParams();
  if (params.source !== "all") qs.set("source", params.source);
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  return `/unanswered?${qs.toString()}`;
}

export function useUnanswered(params: UnansweredListParams) {
  return useQuery({
    queryKey: ["admin", "unanswered", params],
    queryFn: () => apiJson<UnansweredListResponse>(buildUnansweredUrl(params)),
    placeholderData: (prev) => prev,
  });
}
