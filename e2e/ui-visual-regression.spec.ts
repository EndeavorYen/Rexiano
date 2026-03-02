import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  openLibraryDrawer,
  openPlaybackDrawer,
} from "./helpers/appHarness";

test.describe("UI visual regression", () => {
  test.skip(
    process.platform !== "win32",
    "Visual baselines in this repository are currently managed on Windows.",
  );

  test("library MIDI drawer desktop snapshot", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await gotoLibrary(appPage);
    const drawer = await openLibraryDrawer(appPage);
    await waitForUiSettled(appPage);
    await expect(drawer).toHaveScreenshot("library-drawer-desktop.png");
  });

  test("library MIDI drawer mobile snapshot", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 390, height: 844 });
    await gotoLibrary(appPage);
    const drawer = await openLibraryDrawer(appPage);
    await waitForUiSettled(appPage);
    await expect(drawer).toHaveScreenshot("library-drawer-mobile.png");
  });

  test("playback workspace desktop snapshot", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    const workspace = appPage.locator(".workspace-frame");
    await waitForUiSettled(appPage);
    await expect(workspace).toHaveScreenshot("playback-workspace-desktop.png");
  });

  test("playback drawer desktop snapshot", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    const drawer = await openPlaybackDrawer(appPage);
    await waitForUiSettled(appPage);
    await expect(drawer).toHaveScreenshot("playback-drawer-desktop.png");
  });
});
