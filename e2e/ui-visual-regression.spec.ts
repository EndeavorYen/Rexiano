import { type Locator, type Page } from "@playwright/test";
import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  closeTopDrawer,
  gotoLibrary,
  loadFirstBuiltInSong,
  openLibraryDrawer,
  openPlaybackDrawer,
  pausePlaybackIfRunning,
  resetPlaybackPosition,
} from "./helpers/appHarness";

interface ViewportPreset {
  name: string;
  width: number;
  height: number;
}

const DESKTOP_VIEWPORT: ViewportPreset = {
  name: "desktop",
  width: 1600,
  height: 900,
};

const TABLET_VIEWPORT: ViewportPreset = {
  name: "tablet",
  width: 1180,
  height: 820,
};

async function captureSnapshot(
  page: Page,
  fileName: string,
  mask: Locator[] = [],
): Promise<void> {
  await waitForUiSettled(page);
  await expect(page).toHaveScreenshot(fileName, {
    maxDiffPixelRatio: 0.008,
    mask,
  });
}

async function gotoMainMenu(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.location.hash = "#/menu";
  });
  await expect(page.getByTestId("main-menu-view")).toBeVisible({
    timeout: 20_000,
  });
  await waitForUiSettled(page);
}

async function freezePlaybackSnapshot(page: Page): Promise<void> {
  await pausePlaybackIfRunning(page);
  await resetPlaybackPosition(page);
  await waitForUiSettled(page);
}

test.describe("UI visual regression", () => {
  test("main menu and library baselines remain stable", async ({ appPage }) => {
    for (const viewport of [DESKTOP_VIEWPORT, TABLET_VIEWPORT]) {
      await appPage.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await gotoMainMenu(appPage);
      await captureSnapshot(appPage, `main-menu-${viewport.name}.png`, [
        appPage.getByTestId("main-menu-greeting"),
      ]);

      await gotoLibrary(appPage);
      await captureSnapshot(appPage, `library-${viewport.name}.png`, [
        appPage.getByTestId("song-library-greeting"),
      ]);
    }
  });

  test("library drawer and playback workspaces stay visually coherent", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
    });

    await gotoLibrary(appPage);
    await openLibraryDrawer(appPage);
    await captureSnapshot(appPage, "library-midi-drawer-desktop.png", [
      appPage.getByTestId("song-library-greeting"),
    ]);
    await closeTopDrawer(appPage);

    await loadFirstBuiltInSong(appPage);
    await freezePlaybackSnapshot(appPage);

    await captureSnapshot(appPage, "playback-default-desktop.png");

    await openPlaybackDrawer(appPage);
    await captureSnapshot(appPage, "playback-drawer-desktop.png");

    await appPage.getByTestId("display-mode-split").click();
    await closeTopDrawer(appPage);
    await waitForUiSettled(appPage);

    await appPage.getByTestId("practice-toolbar-advanced-toggle").click();
    await waitForUiSettled(appPage);
    await captureSnapshot(appPage, "playback-split-advanced-desktop.png");

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("display-mode-sheet").click();
    await closeTopDrawer(appPage);
    await waitForUiSettled(appPage);
    await captureSnapshot(appPage, "playback-sheet-desktop.png");
  });

  test("insights and settings overlays maintain visual hierarchy", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
    });

    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await freezePlaybackSnapshot(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("insights-trigger").click();
    await expect(appPage.getByTestId("insights-modal")).toBeVisible();
    await captureSnapshot(appPage, "playback-insights-modal.png");

    await appPage.keyboard.press("Escape");
    await expect(appPage.getByTestId("insights-modal")).toBeHidden();

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("settings-trigger").click();
    await expect(appPage.getByTestId("settings-panel")).toBeVisible();
    await captureSnapshot(appPage, "playback-settings-basic.png");

    await appPage.getByTestId("settings-mode-toggle").click();
    await appPage.getByTestId("settings-tab-practice").click();
    await waitForUiSettled(appPage);
    await captureSnapshot(appPage, "playback-settings-advanced-practice.png");
  });

  test("tablet playback split view remains readable", async ({ appPage }) => {
    await appPage.setViewportSize({
      width: TABLET_VIEWPORT.width,
      height: TABLET_VIEWPORT.height,
    });

    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await freezePlaybackSnapshot(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("display-mode-split").click();
    await closeTopDrawer(appPage);
    await waitForUiSettled(appPage);

    await captureSnapshot(appPage, "playback-split-tablet.png");
  });
});
