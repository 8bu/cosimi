import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", ports: "src/ports.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [/^@cosimi\//],
});
