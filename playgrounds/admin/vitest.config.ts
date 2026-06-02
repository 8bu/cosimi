import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// jsdom because component tests render React; the unanswered view +
// teach dialog hit Radix portals and TanStack Query — both need DOM.
// Setup file wires @testing-library/jest-dom matchers globally.
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
