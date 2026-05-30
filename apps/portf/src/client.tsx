import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";
import { useMessagesStore } from "@/store/messages";
import { abortAllInflight } from "@/lib/inflight";
import "@/styles/globals.css";

// Pre-mount: identical timing to the old main.tsx (post-bundle-load,
// pre-paint). Server bundle never imports this file - guarantees zero
// localStorage / window touches during prerender.
useMessagesStore.getState().hydrate();
window.addEventListener("beforeunload", abortAllInflight);

getRouter();
hydrateRoot(document, <StartClient />);
