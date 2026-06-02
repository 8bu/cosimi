import { defineConfig } from "tsup";

// @cosimi/core is a separately published sibling → external. `postgres` is a
// type-only import here (the matcher takes an injected sql accessor), so it
// erases at build time and never enters the bundle.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [/^@cosimi\//],
});
