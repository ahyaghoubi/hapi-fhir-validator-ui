import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dir = path.dirname(fileURLToPath(import.meta.url));
const devHost = process.env.VITE_DEV_HOST ?? "0.0.0.0";

export default defineConfig({
  plugins: [react()],
  root: dir,
  server: {
    host: devHost,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: devHost,
    port: 4173,
  },
  build: {
    outDir: path.join(dir, "dist"),
    emptyOutDir: true,
  },
});
