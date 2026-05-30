import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, waitForUiSettled } from "../e2e/fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "../e2e/helpers/appHarness";

const outputDir = resolve(process.cwd(), "docs/assets/screenshots");

test("captures README screenshots from verified app flows", async ({
  appPage,
}) => {
  mkdirSync(outputDir, { recursive: true });
  await appPage.setViewportSize({ width: 1280, height: 800 });
  await appPage.evaluate(() => {
    localStorage.setItem("rexiano-theme", "ocean");
  });
  await appPage.reload();
  await waitForUiSettled(appPage);

  await gotoLibrary(appPage);
  await appPage.getByTestId("song-library-view-list").click();
  await expect(appPage.getByTestId("song-library-list")).toBeVisible();
  await appPage.screenshot({
    path: join(outputDir, "rexiano-library.png"),
    fullPage: false,
    animations: "disabled",
  });

  await loadFirstBuiltInSong(appPage);
  await expect(appPage.getByTestId("practice-toolbar")).toBeVisible();
  await appPage.screenshot({
    path: join(outputDir, "rexiano-practice.png"),
    fullPage: false,
    animations: "disabled",
  });

  await appPage.getByTestId("playback-drawer-trigger").click();
  await appPage.getByTestId("display-mode-split").click();
  await appPage.locator(".app-side-drawer-header button").first().click();
  await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
  await expect(
    appPage.getByTestId("sheet-music-svg-host").locator("svg"),
  ).toBeVisible({ timeout: 20_000 });
  await appPage.screenshot({
    path: join(outputDir, "rexiano-split-sheet.png"),
    fullPage: false,
    animations: "disabled",
  });
});
