import { expect, test } from "./browser-fixture";
import AxeBuilder from "@axe-core/playwright";

for (const name of [
  "Contact center",
  "Transcription & AI",
  "Jira",
  "Slack & email",
]) {
  test(`demo connects, configures and disconnects ${name}`, async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/"))
        externalRequests.push(request.url());
    });
    await page.goto("/settings");
    await page
      .getByRole("button", { name: `Connect ${name}`, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "No credentials are needed",
    );
    await page.getByRole("button", { name: "Use example settings" }).click();
    await page
      .getByRole("button", { name: "Connect demo", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const row = page
      .locator(".integration-row")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(row).toContainText("Demo connected");
    await page.reload();
    await expect(row).toContainText("Demo connected");
    await page
      .getByRole("button", { name: `Configure ${name}`, exact: true })
      .click();
    await expect(
      page.getByRole("dialog").locator("input").first(),
    ).not.toHaveValue("");
    if (name === "Slack & email") {
      await page.getByRole("combobox", { name: "Send updates to" }).click();
      await page.getByRole("option", { name: "Email", exact: true }).click();
      await page.getByLabel("Notification email").fill("reviews@example.com");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(row).toContainText("reviews@example.com");
      await page
        .getByRole("button", { name: `Configure ${name}`, exact: true })
        .click();
      await expect(
        page.getByRole("combobox", { name: "Send updates to" }),
      ).toContainText("Email");
      await expect(page.getByLabel("Notification email")).toHaveValue(
        "reviews@example.com",
      );
    }
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(row).toContainText("Not connected");
    await page.reload();
    await expect(
      page.getByRole("button", { name: `Connect ${name}`, exact: true }),
    ).toBeVisible();
    expect(externalRequests).toEqual([]);
  });
}

test("connection forms validate destinations and support keyboard and mobile", async ({
  page,
}) => {
  await page.goto("/settings");
  const connect = page.getByRole("button", {
    name: "Connect Jira",
    exact: true,
  });
  await connect.click();
  await page.getByRole("button", { name: "Use example settings" }).click();
  await page
    .getByLabel("Jira site URL")
    .fill("https://token:secret@example.com");
  await page.getByRole("button", { name: "Connect demo" }).click();
  await expect(page.getByRole("alert")).toContainText("without credentials");
  await page.keyboard.press("Escape");
  await expect(connect).toBeFocused();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/settings");
    await expect(connect).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/connections-${width}.png`,
      fullPage: true,
    });
    await connect.click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
  }
});

test("cancel leaves a connection unchanged and corrupt storage can be reset", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Connect Jira", exact: true }).click();
  await page.getByRole("button", { name: "Use example settings" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Connect Jira", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("csi.demo.connections.v1", "invalid"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Saved demo connections could not be read",
  );
  await page
    .getByRole("button", { name: "Reset demo connections", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Connect Jira", exact: true }),
  ).toBeEnabled();
});

test("storage errors keep the form open without reporting a connection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "csi.demo.connections.v1")
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Connect Jira", exact: true }).click();
  await page.getByRole("button", { name: "Use example settings" }).click();
  await page.getByRole("button", { name: "Connect demo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save your demo connection",
  );
  await expect(page.getByText("Demo connected", { exact: true })).toHaveCount(
    0,
  );
});
