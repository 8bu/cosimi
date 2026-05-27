import { create } from "zustand";

interface UiState {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

/**
 * Ephemeral UI state for `apps/portf`. NO `persist` middleware - the mobile
 * sidebar drawer always starts closed on a fresh load. If a future state
 * needs to survive reload, move it to a different store; do NOT add
 * `persist` here.
 */
export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}));
