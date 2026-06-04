import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// The TanStack Router plugin MUST come before the react plugin. The dev proxy
// fronts the two cosimi backends: /api → the public retrieve api (:3000),
// /admin → the loopback ingest/admin api (:3001). Port 5174 so neolab can run
// beside the legacy lab (5173) until cutover.
export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE ?? "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/admin": {
        target: process.env.VITE_ADMIN_BASE ?? "http://localhost:3001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/admin/, ""),
      },
    },
  },
});
