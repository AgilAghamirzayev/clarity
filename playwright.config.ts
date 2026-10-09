import { defineConfig, devices } from "@playwright/test";
const live = process.env.CSI_E2E_API === "true";
const guest = process.env.CSI_E2E_GUEST === "true";
const port = guest ? 4177 : live ? 4175 : 4174;
export default defineConfig({
  testDir: "./tests",
  outputDir: guest
    ? "test-results/guest"
    : live
      ? "test-results/live"
      : "test-results/demo",
  testMatch: guest
    ? "**/live-demo.spec.ts"
    : live
      ? "**/live.spec.ts"
      : [
          "**/workspace.spec.ts",
          "**/automation.spec.ts",
          "**/onboarding.spec.ts",
          "**/recordings.spec.ts",
          "**/connections.spec.ts",
        ],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run ${guest ? "dev" : live ? "dev:api" : "dev:fixture"} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
