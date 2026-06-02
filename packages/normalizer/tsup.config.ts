import { defineConfig } from "tsup";

// Zero runtime deps — fully self-contained NFC/lowercase/whitespace pass.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
});
