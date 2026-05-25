import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// parseSseStream is a pure function over a ReadableStream — no DOM, no
// server. Default `node` env is enough; jsdom would just slow us down.
// If a future Phase 11 test needs hooks/components, switch to jsdom there
// per-file via /** @vitest-environment jsdom */ rather than flipping the
// global default.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
