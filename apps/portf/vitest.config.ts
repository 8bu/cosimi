import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// jsdom + jest-dom matchers + per-test cleanup — mirrors apps/web's setup.
// No TanStackRouterVite here: the router plugin generates a file at build
// time, which we don't need in unit tests (tests render components directly
// or use createMemoryHistory). Including it would force tests to depend on
// the generated tree existing.
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
