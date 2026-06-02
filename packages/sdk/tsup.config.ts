import { defineConfig } from "tsup";

// Constellation model: the @cosimi/* deps are separately published packages, so
// they stay external (not inlined). The runtime entry (`.`) and the Node-only
// offline entry are built separately so a Workers consumer importing `.` never
// pulls offline deps.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "offline/index": "src/offline/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: [/^@cosimi\//, "postgres"],
});
