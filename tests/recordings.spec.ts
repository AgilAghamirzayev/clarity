import { expect, test } from "./browser-fixture";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const fixtures = path.join(import.meta.dirname, "fixtures");
test("imports MP3 and MP4 locally, plays, persists and removes recordings", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/conversations");
  await page
    .getByLabel("Choose recordings", { exact: true })
    .setInputFiles([
      path.join(fixtures, "sample-call.mp3"),
      path.join(fixtures, "sample-call.mp4"),
    ]);
  await expect(page.getByRole("status")).toContainText(
    "2 recordings saved in this browser.",
  );
  await expect(
    page.getByRole("list", { name: "Saved recordings" }).getByRole("listitem"),
  ).toHaveCount(2);
  await page.reload();
  for (const extension of ["mp3", "mp4"]) {
    await page
      .getByRole("button", {
        name: `Play sample-call.${extension}`,
        exact: true,
      })
      .click();
    const player = page.locator("audio");
    await expect(player).toBeVisible();
    await expect
      .poll(() =>
        player.evaluate((audio: HTMLAudioElement) => audio.readyState),
      )
      .toBeGreaterThanOrEqual(1);
    await player.evaluate((audio: HTMLAudioElement) => audio.play());
    await expect
      .poll(() =>
        player.evaluate((audio: HTMLAudioElement) => audio.currentTime),
      )
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/imports-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Remove sample-call.mp3", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play sample-call.mp3", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  expect(apiRequests).toEqual([]);
});

test("invalid files are rejected without saving any part of the batch", async ({
  page,
}) => {
  await page.goto("/conversations");
  await page.getByLabel("Choose recordings", { exact: true }).setInputFiles([
    { name: "call.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("ID3") },
    {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not audio"),
    },
  ]);
  await expect(page.getByRole("alert")).toContainText(
    "choose an MP3, MP4, M4A, WAV or FLAC file",
  );
  await expect(
    page.getByRole("list", { name: "Saved recordings" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Choose recordings", { exact: true })
    .setInputFiles([
      { name: "empty.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(0) },
    ]);
  await expect(page.getByRole("alert")).toContainText("this file is empty");
});

test("storage failures explain how to retry without claiming an import succeeded", async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  await page.goto("/conversations");
  await page
    .getByLabel("Choose recordings", { exact: true })
    .setInputFiles(path.join(fixtures, "sample-call.mp3"));
  await expect(
    page.getByText(
      "Could not save recordings in this browser. Free up storage or allow browser storage, then try again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Saved recordings" }),
  ).toHaveCount(0);
});
