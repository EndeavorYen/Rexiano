import { test, expect } from "./fixtures/electronApp";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  openPlaybackDrawer,
} from "./helpers/appHarness";

test.describe("Piano roll editor flow", () => {
  test("playback drawer has no piano-roll entry", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });

    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await openPlaybackDrawer(appPage);

    await expect(appPage.getByTestId("playback-settings-drawer")).toBeVisible();
    await expect(appPage.getByTestId("open-editor")).toHaveCount(0);
    await expect(appPage.getByTestId("piano-roll-editor")).toHaveCount(0);
  });
});
