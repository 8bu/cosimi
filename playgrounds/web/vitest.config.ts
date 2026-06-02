import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// Phase 15 flipped this from `node` to `jsdom` so ThemeToggle (and any
// future component-render tests) can mount React into a real document.
// The legacy pure tests (sse-parser, store, i18n) work unchanged in
// jsdom — none touch Node-only globals beyond `ReadableStream`, which
// jsdom polyfills. Setup file wires jest-dom matchers and the
// per-test cleanup() that apps/admin uses.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/lib/test-setup.ts"],
    globals: false,
  },
});
