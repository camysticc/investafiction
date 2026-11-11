import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In browser development the API is served by the Rust dev server on 8765.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, proxy: { "/api": "http://127.0.0.1:8765" } },
  build: { target: "es2021", outDir: "dist", chunkSizeWarningLimit: 900 },
});
