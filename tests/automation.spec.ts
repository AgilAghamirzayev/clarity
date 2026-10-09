import { expect, test } from "./browser-fixture";
import AxeBuilder from "@axe-core/playwright";

test("company settings persist, preview uses the draft, and export uses saved configuration", async ({
  page,
}) => {
  await page.goto("/automation");
  await expect(
    page.getByRole("heading", { name: "Automation & AI", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "It arrives automatically",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retail & commerce", exact: true })
    .click();
  await page
    .getByLabel("Analysis rules", { exact: true })
    .fill(
      "Separate refund confusion from delivery delays. Cite the customer's words.",
    );
  await page
    .getByRole("button", { name: "Preview instructions", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Agent instructions" });
  await expect(preview).toContainText(
    "Separate refund confusion from delivery delays",
  );
  await expect(preview).toContainText(
    "Company preferences cannot remove evidence requirements",
  );
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save configuration", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Analysis configuration saved",
  );
  await page.reload();
  await expect(page.getByLabel("Analysis rules", { exact: true })).toHaveValue(
    /Separate refund confusion/,
  );
  await expect(
    page.getByText("Saved configuration · Version 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Analysis rules", { exact: true })
    .fill("Unsaved draft rules");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export saved skill", exact: true })
    .click();
  const file = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file!) chunks.push(chunk);
  const bundle = JSON.parse(Buffer.concat(chunks).toString());
  expect(bundle.systemPrompt).toContain("Separate refund confusion");
  expect(bundle.systemPrompt).not.toContain("Unsaved draft rules");
  expect(
    bundle.tools.every((tool: { method: string }) => tool.method === "GET"),
  ).toBe(true);
});

for (const width of [390, 1440])
  test(`automation settings fit ${width}px with accessible controls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/automation");
    await expect(
      page.getByLabel("Company context", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });

test("storage failure does not claim that configuration was saved", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "clarity:analysis-profile:v1")
        throw new Error("Storage unavailable");
      return original.call(this, key, value);
    };
  });
  await page.goto("/automation");
  await page
    .getByLabel("Company context", { exact: true })
    .fill("Service desk");
  await page
    .getByRole("button", { name: "Save configuration", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Storage unavailable");
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
});
