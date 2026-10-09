import { expect, test } from "./browser-fixture";

test("rejected findings remain visible and are not presented as a clean no-problem call", async ({
  page,
}, testInfo) => {
  await page.goto("/conversations");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  const workspace = await (await page.request.get("/api/v1/workspace")).json();
  const id = workspace.conversations[0].id;
  await page.route(`**/api/v1/calls/${id}`, async (route) => {
    const response = await route.fetch();
    const record = await response.json();
    record.issueIds = [];
    record.analysis = {
      ...record.analysis,
      reviewRequired: true,
      roleUncertainty: true,
      summaryMode: "source-excerpts",
      summary:
        'Speaker roles are unverified. Transcript excerpts: [0] "Payment failed"',
      issues: [],
      rejectedFindings: [
        { chunkStart: 0, findingIndex: 0, code: "AGENT_ONLY_EVIDENCE" },
      ],
    };
    await route.fulfill({ response, json: record });
  });
  await page.goto(`/conversations/${id}`);
  await expect(
    page.getByText("Evidence review needed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "1 proposed finding(s) failed validation",
  );
  await expect(page.getByRole("status")).toContainText(
    "Speaker roles are unverified",
  );
  await expect(page.getByText(/No accepted issue is linked/)).toBeVisible();
  await expect(
    page.getByText("No issue identified in this conversation."),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("review-notice-mobile.png"),
    fullPage: true,
  });
});

test("every guest receives playable samples, linked insights and completed reports", async ({
  page,
}) => {
  await page.goto("/conversations");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(8);
  await expect(page.locator("tbody")).toContainText(
    "Payment declined during checkout",
  );
  const workspace = await (await page.request.get("/api/v1/workspace")).json();
  expect(workspace.conversations).toHaveLength(8);
  expect(workspace.issues.length).toBeGreaterThan(0);
  expect(workspace.recommendations.length).toBeGreaterThan(3);
  expect(workspace.decisions).toHaveLength(3);
  await rows.first().getByRole("link").click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
  const audio = await page.request.get(
    (await page.locator("audio").getAttribute("src"))!,
  );
  expect(audio.ok()).toBeTruthy();
  expect((await audio.body()).length).toBeGreaterThan(100000);
  await page
    .getByRole("button", { name: /Play recording from/ })
    .nth(1)
    .click();
  await expect(
    page.locator('.transcript-segment[data-active="true"]'),
  ).toBeVisible();
  await page.goto("/summary");
  await expect(
    page.getByRole("button", { name: "Refresh analysis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Overall assessment" }),
  ).toBeVisible();
  await expect(page.locator(".summary-advice").first()).toBeVisible();
  await page.getByRole("combobox", { name: "Summary period" }).click();
  await page.getByRole("option", { name: "Last 30 days", exact: true }).click();
  await expect(page.locator(".summary-advice")).toHaveCount(3);
  const evidence = page.locator(".summary-evidence a").first();
  await evidence.click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
  await page.goto("/decisions");
  await expect(page.locator("main")).toContainText("Sample review history");
  await page.goto("/conversations");
  await page.reload();
  await expect(rows).toHaveCount(8);
});

test("guest uploads a sample and receives real transcript, analysis and evidence", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  await page.goto("/conversations");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Conversations",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Analyze sample call" }).click();
  const row = page
    .locator(".import-row")
    .filter({ hasText: "Card payment declined at checkout" });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("link", { name: "View conversation" }),
  ).toBeVisible({ timeout: 180000 });
  const href = await row
    .getByRole("link", { name: "View conversation" })
    .getAttribute("href");
  await row.getByRole("link", { name: "View conversation" }).click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(/payment/i);
  await expect(page.locator("audio")).toBeVisible();
  const audio = await page.request.get(
    (await page.locator("audio").getAttribute("src")) as string,
  );
  expect(audio.status()).toBe(200);
  expect((await audio.body()).length).toBeGreaterThan(100000);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript" }),
  ).toBeVisible();
  const other = await browser.newContext();
  const visitor = await other.newPage();
  await visitor.goto("/conversations");
  await visitor
    .getByRole("link", { name: "Try fresh analysis", exact: true })
    .click();
  await expect(
    visitor.getByRole("button", { name: "Analyze sample call" }),
  ).toBeVisible();
  const unauthorized = await visitor.request.get(
    `/api/v1/calls/${href!.split("/").pop()}`,
  );
  expect(unauthorized.status()).toBe(404);
  await expect(visitor.locator(".import-row")).toHaveCount(0);
  await other.close();
});
