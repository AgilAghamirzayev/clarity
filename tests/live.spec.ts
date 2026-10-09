import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("sign in, inspect import and integration controls, and sign out", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  await page
    .getByLabel("Workspace", { exact: true })
    .fill(process.env.BOOTSTRAP_TENANT ?? "local");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.BOOTSTRAP_EMAIL ?? "admin@csi.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.BOOTSTRAP_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Listen closer. See the bigger picture.",
  );
  await page.getByRole("link", { name: "Conversations", exact: true }).click();
  await page.getByRole("button", { name: "Import recording" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Workspace settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Integration configuration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Server audit" }),
  ).toBeVisible();
  for (const width of [1440, 1024, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Listen closer. See the bigger picture.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/live-overview-${width}.png`,
      fullPage: true,
    });
    await page.goto("/conversations");
    await expect(
      page.getByRole("heading", { name: "Recording imports" }),
    ).toBeVisible();
    await expect(page.locator("tbody .table-link").first()).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    await page.getByRole("button", { name: "View upload history" }).click();
    await expect(page.locator(".import-row").first()).toBeVisible();
    await expect(page.locator(".import-list")).not.toContainText("COMPLETED");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/live-conversations-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Hide upload history" }).click();
    await page.locator("tbody .table-link").first().click();
    await expect(
      page.getByRole("heading", { name: "Conversation transcript" }),
    ).toBeVisible();
    await expect(page.locator(".eyebrow").first()).toContainText("CALL-");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
