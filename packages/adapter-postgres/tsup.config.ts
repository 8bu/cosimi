import { defineConfig } from "tsup";

// Single entry bundles the internal `#client` / `#repositories/*` subpaths
// inline, so the published dist carries no `#` self-references. `postgres` is a
// peerDependency the consumer injects; @cosimi/* siblings + yaml are external.
// The seed/provision scripts are dev-only (run via tsx) and not built.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [/^@cosimi\//, "postgres"],
});
