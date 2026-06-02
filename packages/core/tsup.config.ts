import { defineConfig } from "tsup";

// valibot is a runtime dependency → tsup auto-externalizes it (deps +
// peerDeps are never bundled). dts emits the published `.d.ts`.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
});
