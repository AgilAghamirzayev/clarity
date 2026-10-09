import { defineConfig, devices } from "@playwright/test";
const live = process.env.CSI_E2E_API === "true";
const port = live ? 4175 : 4174;
export default defineConfig({
  testDir: "./tests",
  outputDir: live ? "test-results/live" : "test-results/demo",
  testMatch: live ? "**/live.spec.ts" : "**/workspace.spec.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: { VITE_DATA_MODE: live ? "api" : "demo" },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
