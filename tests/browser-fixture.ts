import { test as base, expect } from "@playwright/test";

// Feature tests represent a returning visitor. Fresh-visit behavior is covered in onboarding.spec.ts.
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await page.addInitScript(() => {
      localStorage.setItem("clarity:onboarding:v1", "dismissed");
    });
    await runTest(page);
  },
});
export { expect };
