import { defineConfig } from "tsup";

// pino + @cosimi/core are runtime deps → external (auto for pino, explicit
// regex for the sibling scope).
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [/^@cosimi\//],
});
