import type { UnansweredRow } from "@/lib/api/raw-types";
import type { MissVM } from "./view-models";

export function toMissVM(row: UnansweredRow): MissVM {
  return {
    id: row.id,
    query: row.input,
    count: row.count,
    lastSeen: row.last_seen,
    source: row.source,
  };
}
