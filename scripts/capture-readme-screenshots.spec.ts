import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, waitForUiSettled } from "../e2e/fixtures/app";
import {
  choosePracticeMode,
  gotoLibrary,
  startBuiltInSongFromLibrary,
} from "../e2e/helpers/appHarness";

/**
 * README / GitHub Pages screenshots, in English and Traditional Chinese.
 *
 *   pnpm build:e2e && pnpm exec playwright test \
 *     -c scripts/playwright.readme-screenshots.config.ts
 */
const outputDir = resolve(process.cwd(), "docs/assets/screenshots");
const SONG = "burgmuller-01-candor";

for (const [language, suffix] of [
  ["en", ""],
  ["zh-TW", "-zh"],
] as const) {
  test(`captures README screenshots (${language})`, async ({ appPage }) => {
    mkdirSync(outputDir, { recursive: true });
    await appPage.setViewportSize({ width: 1280, height: 800 });
    await appPage.evaluate((lang) => {
      const key = "rexiano-settings";
      const settings = JSON.parse(localStorage.getItem(key) ?? "{}");
      localStorage.setItem(
        key,
        JSON.stringify({ ...settings, language: lang }),
      );
      localStorage.setItem("rexiano-theme", "light");
    }, language);
    await appPage.reload();
    await waitForUiSettled(appPage);

    await gotoLibrary(appPage);
    await appPage.getByTestId("song-library-view-list").click();
    await expect(appPage.getByTestId("song-library-list")).toBeVisible();
    await waitForUiSettled(appPage);
    await appPage.screenshot({
      path: join(outputDir, `rexiano-library${suffix}.png`),
      animations: "disabled",
    });

    await startBuiltInSongFromLibrary(appPage, SONG);
    await choosePracticeMode(appPage, "watch");
    await expect(appPage.locator(".workspace-frame")).toBeVisible();
    await appPage.getByTestId("display-mode-falling").click();
    // Let the first notes fall onto the keyboard, then hold the frame.
    await appPage.waitForTimeout(4_000);
    const strip = appPage.getByTestId("transport-strip");
    await strip.locator("button").first().click();
    await waitForUiSettled(appPage);
    await appPage.screenshot({
      path: join(outputDir, `rexiano-practice${suffix}.png`),
      animations: "disabled",
    });

    // Back to the top so the sheet shows its clefs, then a short run.
    await strip.locator("button").nth(1).click();
    await appPage.getByTestId("display-mode-split").click();
    await strip.locator("button").first().click();
    await appPage.waitForTimeout(1_500);
    await strip.locator("button").first().click();
    await expect(
      appPage.getByTestId("sheet-music-svg-host").locator("svg"),
    ).toBeVisible({ timeout: 20_000 });
    await waitForUiSettled(appPage);
    await appPage.screenshot({
      path: join(outputDir, `rexiano-split-sheet${suffix}.png`),
      animations: "disabled",
    });
  });
}
