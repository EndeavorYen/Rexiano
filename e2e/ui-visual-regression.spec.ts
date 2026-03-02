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

  test("playback header and control bars desktop snapshot", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    // Pause playback for stable visual baselines.
    await appPage
      .getByTestId("transport-strip")
      .locator("button")
      .first()
      .click();

    await waitForUiSettled(appPage);
    await expect(appPage.getByTestId("playback-header-panel")).toHaveScreenshot(
      "playback-header-desktop.png",
    );
    await expect(appPage.getByTestId("transport-strip")).toHaveScreenshot(
      "playback-transport-desktop.png",
    );
    await expect(appPage.getByTestId("practice-toolbar")).toHaveScreenshot(
      "playback-practice-toolbar-desktop.png",
    );
  });
});
