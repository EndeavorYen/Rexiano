import { test, expect } from "./fixtures/electronApp";
import {
  closeTopDrawer,
  gotoLibrary,
  loadFirstBuiltInSong,
  openLibraryDrawer,
  openPlaybackDrawer,
} from "./helpers/appHarness";

test.describe("App routing and drawer behavior", () => {
  test("playback hash falls back to menu when no song is loaded", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      window.location.hash = "#/playback";
    });

    await expect(
      appPage.getByRole("button", { name: /Start Practicing/i }),
    ).toBeVisible();
    await expect(appPage.getByTestId("playback-drawer-trigger")).toHaveCount(0);
  });

  test("library route is reachable and MIDI drawer can open/close", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await openLibraryDrawer(appPage);
    await closeTopDrawer(appPage);
  });

  test("loaded song forces playback route and playback drawer works", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    await appPage.evaluate(() => {
      window.location.hash = "#/menu";
    });

    await expect(appPage.getByTestId("playback-drawer-trigger")).toBeVisible();

    await openPlaybackDrawer(appPage);
    await expect(appPage.getByTestId("settings-trigger")).toBeVisible();
    await closeTopDrawer(appPage);
  });
});
