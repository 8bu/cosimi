import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "@/App";
import { Toaster } from "@/components/ui/sonner";
import { bootstrapTheme } from "@/lib/theme";
import "@/styles/globals.css";

// Apply persisted theme to <html data-theme> before render to avoid a
// light → dark flash for persisted-dark users (mirrors apps/web).
bootstrapTheme();

// Same defaults as apps/web: retry once on transient network blips,
// don't refetch on focus (admin tables are tabular dashboards, not
// real-time tickers — Phase 13's pairs CRUD will lean on explicit
// invalidations after mutations). Per-app QueryClient instance —
// crossing app boundaries with a shared client would re-couple them.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        {/* Toaster at the root, outside <App />'s route remounts (matches
            apps/web). Sonner portals into <body>, so visual placement
            is unaffected by the parent. */}
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
