import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    // Le front appelle /api/... ; Vite relaie vers le serveur Express,
    // qui est le seul à connaître la clé API.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
