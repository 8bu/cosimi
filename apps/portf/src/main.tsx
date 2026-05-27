import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";
import { abortAllInflight } from "@/lib/inflight";
import { useMessagesStore } from "@/store/messages";
import "@/styles/globals.css";

// Hydrate the messages store from localStorage BEFORE the first render so
// `/chat/<id>` doesn't paint an empty transcript and then snap to the
// rehydrated contents.
useMessagesStore.getState().hydrate();

// Flush in-flight aborts (and any pending persist) on tab close. Use
// `beforeunload` (not `unload`) - Safari and modern Chrome treat `unload`
// as best-effort only.
window.addEventListener("beforeunload", abortAllInflight);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster position="top-right" richColors closeButton />
  </StrictMode>,
);
