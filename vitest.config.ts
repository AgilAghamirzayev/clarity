import { defineConfig } from "vitest/config";
export default defineConfig({
  define: { "import.meta.env.VITE_DATA_MODE": JSON.stringify("demo") },
  test: { include: ["src/**/*.test.ts"] },
});
