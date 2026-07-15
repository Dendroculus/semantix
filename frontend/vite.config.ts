import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  cacheDir: ".vite-cache",

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 200,
    },
    hmr: {
      clientPort: 4173,
    },
  },
});
