import type { RetrievalResult } from "@/lib/api/types";

export type RetrievalTurn =
  | { id: string; query: string; status: "loading" }
  | { id: string; query: string; status: "done"; result: RetrievalResult }
  | { id: string; query: string; status: "error"; message: string };
