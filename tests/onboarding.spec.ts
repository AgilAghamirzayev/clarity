import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Step ids below assert the full product story rather than the generated step count.
const ids = [
  "purpose",
  "metrics",
  "period",
  "trends",
  "import",
  "sentiment",
  "call-list",
  "audio",
  "transcript",
  "call-summary",
  "issues",
  "evidence",
  "proposal",
  "review",
  "summary-metrics",
  "advice",
  "connections",
  "restart",
];

test("first visit explains the demo, can be skipped and stays dismissed", async ({
  page,
}) => {
  await page.goto("/conversations");
  const welcome = page.getByRole("dialog", { name: "Meet Clarity" });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText("offline preview does not run AI models");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Explore on my own" }).click();
  await page.reload();
  await expect(welcome).toHaveCount(0);
  await page
    .getByRole("link", { name: "Getting started", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start guided tour", exact: true })
    .click();
  await expect(
    page.locator('.clarity-spotlight[data-tour-step="purpose"]'),
  ).toBeVisible();
});

test("spotlights every function across routes, resumes, goes back and completes without mutations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Start guided tour" }).click();
  await expect(page.getByRole("dialog", { name: "Meet Clarity" })).toHaveCount(
    0,
  );
  const popover = page.locator(".clarity-spotlight");
  for (const [index, id] of ids.entries()) {
    await expect(popover).toHaveAttribute("data-tour-step", id);
    await expect(page.locator(".driver-overlay")).toBeVisible();
    await expect(popover.locator(".driver-popover-title")).toBeFocused();
    await expect(page.locator(".driver-active-element")).not.toHaveAttribute(
      "id",
      "driver-dummy-element",
    );
    await expect(popover.locator(".spotlight-unavailable")).toHaveCount(0);
    await expect(popover.locator(".driver-popover-progress-text")).toHaveText(
      `${index + 1} / 18`,
    );
    if (id === "import") {
      await page.locator(".driver-active-element").press("Enter");
      await expect(
        page.getByRole("dialog", { name: /Import|Add recordings/ }),
      ).toHaveCount(0);
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () =>
            !!document.activeElement?.closest(
              ".clarity-spotlight, .driver-active-element",
            ),
        ),
      ).toBe(true);
    }
    if (id === "transcript") {
      await page.reload();
      await expect(popover).toHaveAttribute("data-tour-step", "transcript");
      await popover.getByRole("button", { name: "Back", exact: true }).click();
      await expect(popover).toHaveAttribute("data-tour-step", "audio");
      await popover.getByRole("button", { name: "Next", exact: true }).click();
      await expect(popover).toHaveAttribute("data-tour-step", "transcript");
    }
    if (id === "review") {
      await expect(page.locator(".driver-active-element")).toHaveClass(
        /decision-footer/,
      );
      expect(
        await page.evaluate(() =>
          localStorage.getItem("csi.demo.decisions.v1"),
        ),
      ).toBeNull();
    }
    await popover
      .getByRole("button", {
        name: index === ids.length - 1 ? "Finish tour" : "Next",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("dialog", { name: "Ready to explore" }),
  ).toBeVisible();
  await expect(page.locator(".driver-overlay")).toHaveCount(0);
  await page.getByRole("link", { name: "Open demo guide" }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Restart guided tour" }).click();
  await expect(popover).toHaveAttribute("data-tour-step", "purpose");
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(page.locator(".driver-active-element")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("first visitor can reach conversations without taking the tour", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("dialog", { name: "Meet Clarity" })
    .getByRole("link", { name: "Open conversations", exact: true })
    .click();
  await expect(page).toHaveURL(/\/conversations$/);
  await expect(page.getByRole("dialog", { name: "Meet Clarity" })).toHaveCount(
    0,
  );
  await expect(page.locator(".clarity-spotlight")).toHaveCount(0);
});

for (const width of [320, 768]) {
  test(`spotlight is accessible, fits ${width}px and supports reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Start guided tour" }).click();
    const popover = page.locator(".clarity-spotlight");
    await expect(popover).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/driver-fade/);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    for (let step = 0; step < ids.length - 1; step++) {
      await expect(popover).toHaveAttribute("data-tour-step", ids[step]);
      const rect = await popover.boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      expect(rect!.y).toBeGreaterThanOrEqual(0);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(844);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await popover.getByRole("button", { name: "Next", exact: true }).click();
    }
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
  });
}

test("missing targets offer an explanation and an exit instead of getting stuck", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("clarity:onboarding:v1", "touring");
    localStorage.setItem("clarity:onboarding:spotlight-step:v2", "0");
    const original = Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll = function (selector: string) {
      return original.call(
        this,
        selector === ".page-heading" ? ".missing-tour-target" : selector,
      );
    };
  });
  await page.goto("/");
  const popover = page.locator(".clarity-spotlight");
  await expect(popover.locator(".spotlight-unavailable")).toBeVisible({
    timeout: 10000,
  });
  await popover.getByRole("button", { name: "Next", exact: true }).click();
  await expect(popover).toHaveAttribute("data-tour-step", "metrics");
  await page.keyboard.press("Escape");
  await expect(page.locator(".driver-overlay")).toHaveCount(0);
});

test("blocked storage does not trap a visitor", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("clarity:onboarding"))
        throw new Error("Storage unavailable");
      return original.call(this, key, value);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start guided tour" }).click();
  const popover = page.locator(".clarity-spotlight");
  await expect(popover).toBeVisible();
  await popover
    .getByRole("button", { name: "Skip tour", exact: true })
    .last()
    .click();
  await expect(popover).toHaveCount(0);
});
