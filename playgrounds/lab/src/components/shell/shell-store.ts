import { create } from "zustand";

interface ShellState {
  rail: "open" | "collapsed";
  toggleRail: () => void;
}

export const useShell = create<ShellState>((set) => ({
  rail: "open",
  toggleRail: () => set((s) => ({ rail: s.rail === "open" ? "collapsed" : "open" })),
}));
