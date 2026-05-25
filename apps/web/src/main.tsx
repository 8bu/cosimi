import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "@/App";
import { loadLocale } from "@/lib/i18n";
import { usePreferences } from "@/store/preferences";
import "@/styles/globals.css";

// retry: 1 — one quick retry covers transient blips without hiding real
// errors behind a long backoff. refetchOnWindowFocus: false — the chat
// experience is conversational, not dashboard-y; tab-switching shouldn't
// trigger refetch storms.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

// Block first paint on the persisted-locale dict load. vi is the eager
// baseline (bundled in main) so vi-default users skip the await
// instantly. Other locales (currently just en) dynamic-import their
// chunk here so the first render has the correct strings — no flash
// from "BẠN" to "YOU" on a persisted-en reload.
//
// Wrapped in an async IIFE because Vite's default build target (es2020)
// doesn't allow top-level await. Bumping to es2022 would work too; the
// IIFE keeps the supported-browser baseline unchanged.
void (async () => {
  await loadLocale(usePreferences.getState().primaryLocale);
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
})();
