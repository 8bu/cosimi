import { create } from "zustand";

/** Jobs started this session. No list-all endpoint exists, so the Queue card +
   sidebar "in pipeline" count derive from here. */
interface IngestState {
  jobIds: string[];
  addJob: (id: string) => void;
  removeJob: (id: string) => void;
}

export const useIngestStore = create<IngestState>((set) => ({
  jobIds: [],
  addJob: (id) => set((s) => (s.jobIds.includes(id) ? s : { jobIds: [...s.jobIds, id] })),
  removeJob: (id) => set((s) => ({ jobIds: s.jobIds.filter((j) => j !== id) })),
}));
