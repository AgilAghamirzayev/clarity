import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("overview changes periods and opens evidence", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(page.locator(".stat-value").first()).toHaveText("34");
  await page.getByLabel("Overview period").selectOption("30");
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
  await page.getByLabel("Filter by sentiment").selectOption("Positive");
  await expect(page.locator("tbody")).not.toContainText("Negative");
  await page.reload();
  await expect(page.getByLabel("Filter by sentiment")).toHaveValue("Positive");
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
  await page.getByLabel("Your decision").selectOption("Rejected");
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
  await page.getByLabel("Summary period").selectOption("30");
  await expect(page.locator(".summary-metrics")).toContainText("126");
  await page.getByLabel("Include sample recordings").uncheck();
  await expect(
    page.getByRole("heading", { name: "There is not enough evidence yet" }),
  ).toBeVisible();
  await page.getByLabel("Include sample recordings").check();
  await page.locator(".summary-evidence a").first().click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
});
