import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  closeTopDrawer,
  gotoLibrary,
  loadFirstBuiltInSong,
  openPlaybackDrawer,
  setDisplayMode,
} from "./helpers/appHarness";

test.describe("Sheet-only Wait Mode", () => {
  test("keeps playback gated with no falling-notes renderer mounted", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    await openPlaybackDrawer(appPage);
    await setDisplayMode(appPage, "sheet");
    await closeTopDrawer(appPage);
    await waitForUiSettled(appPage);

    await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
    await expect(appPage.getByTestId("falling-notes-panel")).toBeHidden();

    // Playback time is owned by TransportClock, not by the PixiJS ticker, so
    // sheet-only mode unmounts the renderer outright rather than hiding it.
    // If this canvas ever comes back, the clock has been coupled to the view
    // again and the gating below would only be passing by accident.
    await expect(
      appPage.getByTestId("falling-notes-panel").locator("canvas"),
    ).toHaveCount(0);

    const seekSlider = appPage.getByRole("slider", {
      name: /seek position/i,
    });
    await expect(seekSlider).toBeVisible();

    const playButton = appPage.getByRole("button", { name: "Play" });
    if ((await playButton.count()) > 0) {
      await playButton.click();
    }
    await appPage.waitForTimeout(1_200);

    const currentTime = Number(await seekSlider.inputValue());
    expect(currentTime).toBeLessThan(0.3);
  });
});
