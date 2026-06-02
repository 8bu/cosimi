import { defineConfig } from "tsup";

// Two entries mirror the `exports` map (`.` + `./ports`). The migrate CLI
// (`src/migrate.ts`) is intentionally NOT an entry — it stays an in-repo tsx
// operator tool; the published surface is `applyMigrations()` + the shipped
// `migrations/` .sql files. `postgres` is type-only in the library path.
export default defineConfig({
  entry: { index: "src/index.ts", ports: "src/ports.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [/^@cosimi\//, "postgres"],
});
