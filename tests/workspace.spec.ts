import { expect, test } from "./browser-fixture";
import AxeBuilder from "@axe-core/playwright";

test("demo opens automatically without authentication or API requests", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(page.locator(".profile")).toContainText("Demo account");
  await expect(
    page.getByRole("button", { name: /sign in|sign out|register/i }),
  ).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("csi:unauthorized")),
  );
  await page.goto("/summary");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Support summary",
  );
  await page.goto("/settings");
  await expect(
    page.getByText("Demo reviewer · No sign-in required"),
  ).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test("overview changes periods and opens evidence", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(page.locator(".stat-value").first()).toHaveText("34");
  await page.getByRole("combobox", { name: "Overview period" }).click();
  await page.getByRole("option", { name: "Last 30 days", exact: true }).click();
  await expect(page.locator(".stat-value").first()).toHaveText("126");
  await page.getByRole("link", { name: "Explore issue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Supporting conversations" }),
  ).toBeVisible();
  await page.locator(".evidence-list a").first().click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("conversation search, empty state, pagination and sort", async ({
  page,
}) => {
  await page.goto("/conversations");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await page.getByLabel("Search conversations").fill("verification");
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
  await expect(page.locator("tbody")).not.toContainText("Card delivery");
  await page.getByLabel("Search conversations").fill("not-a-real-conversation");
  await expect(
    page.getByRole("heading", { name: "No results found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Search conversations")).toHaveValue("");
  await page
    .getByRole("group", { name: "Filter by sentiment" })
    .getByRole("button", { name: "Positive", exact: true })
    .click();
  await expect(page.locator("tbody")).not.toContainText("Negative");
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Filter by sentiment" })
      .getByRole("button", { name: "Positive", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("review validation, persistence, lifecycle, and reset", async ({
  page,
}) => {
  await page.goto("/decisions?recommendation=REC-001");
  await page.getByRole("button", { name: "Review proposal" }).click();
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(
    page.getByText("Enter an owner with at least 2 characters."),
  ).toBeVisible();
  await page.getByLabel("Action owner").fill("Digital Experience");
  await page
    .getByLabel("Reason for this decision")
    .fill("Investigate SMS delivery logs before choosing a fallback provider.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Owner: Digital Experience")).toBeVisible();
  await page.getByRole("button", { name: "Start action" }).click();
  await page.getByRole("button", { name: "Mark action complete" }).click();
  await expect(
    page.getByText("Action marked complete in this demo.", { exact: false }),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Reset demo decisions" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset demo decisions" }).click();
  await page
    .getByRole("button", { name: "Reset decisions", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Demo decisions have been reset.",
  );
  await page.goto("/decisions?recommendation=REC-001");
  await expect(
    page.getByRole("button", { name: "Review proposal" }),
  ).toBeVisible();
});

test("rejects a proposal and does not offer an execution action", async ({
  page,
}) => {
  await page.goto("/decisions?recommendation=REC-002");
  await page.getByRole("button", { name: "Review proposal" }).click();
  await page.getByRole("combobox", { name: "Your decision" }).click();
  await page
    .getByRole("option", { name: "Reject recommendation", exact: true })
    .click();
  await page.getByLabel("Action owner").fill("Card Operations");
  await page
    .getByLabel("Reason for this decision")
    .fill("Need to validate the delivery evidence before taking this action.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.locator(".decision-meta")).toContainText("Rejected");
  await expect(page.getByRole("button", { name: "Start action" })).toHaveCount(
    0,
  );
});

for (const width of [320, 768, 1024, 1440]) {
  test(`responsive layout and accessibility at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/overview-${width}.png`,
      fullPage: true,
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          reason: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    if (width < 1024) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Conversations" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Conversations",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
}

test("dialog supports keyboard dismissal and accessible form controls", async ({
  page,
}) => {
  await page.goto("/decisions?recommendation=REC-001");
  const review = page.getByRole("button", { name: "Review proposal" });
  await review.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(review).toBeFocused();
});

test("invalid routes and missing records have recovery links", async ({
  page,
}) => {
  await page.goto("/conversations/not-found");
  await expect(
    page.getByRole("heading", { name: "Conversation not found" }),
  ).toBeVisible();
  await page.goto("/issues/not-found");
  await expect(
    page.getByRole("heading", { name: "Issue not found" }),
  ).toBeVisible();
  await page.goto("/unknown");
  await page.getByRole("link", { name: "Back to overview" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
});

test("support summary changes period and distinguishes sample data", async ({
  page,
}) => {
  await page.goto("/summary");
  await expect(
    page.getByRole("heading", { name: "Support summary", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Policy & communication" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Product & engineering" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Support operations" }),
  ).toBeVisible();
  await expect(page.locator(".summary-metrics").first()).toContainText("34");
  await page.getByRole("combobox", { name: "Summary period" }).click();
  await page.getByRole("option", { name: "Last 30 days", exact: true }).click();
  await expect(page.locator(".summary-metrics")).toContainText("126");
  await expect(page.getByLabel("Include sample recordings")).toHaveCount(0);
  await page.goto("/summary?period=30&samples=false");
  await expect(page.locator(".summary-metrics")).toContainText("126");
  await page.locator(".summary-evidence a").first().click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
});

test("navigation motion preserves filters and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/conversations");
  await expect(page.locator(".page-content")).toHaveCSS("opacity", "1");
  await page.getByLabel("Search conversations").fill("verification");
  await expect(page.getByLabel("Search conversations")).toBeFocused();
  await expect(page.locator("tbody")).toContainText("verification", {
    ignoreCase: true,
  });
  await page
    .getByRole("link", { name: "Issue intelligence", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Issue intelligence",
  );
  await page
    .getByRole("link", { name: "Support summary", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Support summary",
  );
  await expect(page.locator(".nav-link.active")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".sidebar .nav-indicator")).toHaveCount(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/decisions?recommendation=REC-001");
  await expect(page.locator(".page-content")).toHaveCSS("transform", "none");
  await expect(page.locator(".page-content")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Review proposal" }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review proposal" }),
  ).toBeFocused();

  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(page.locator(".navigation-drawer")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await menu.click();
  await expect(page.locator(".navigation-drawer")).toHaveCSS(
    "animation-name",
    "drawer-in",
  );
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Conversations", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Conversations",
  );
});
