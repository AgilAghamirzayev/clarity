import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Choose explicit modes without bundling private local environment settings.
  define: {
    "import.meta.env.VITE_DATA_MODE": JSON.stringify(
      mode === "fixture" ? "demo" : mode === "api" ? "api" : "live-demo",
    ),
  },
  server: {
    proxy: mode !== "fixture" ? { "/api": "http://127.0.0.1:8086" } : undefined,
  },
}));
