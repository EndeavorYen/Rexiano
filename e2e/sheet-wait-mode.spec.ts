import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  closeTopDrawer,
  gotoLibrary,
  loadFirstBuiltInSong,
  openPlaybackDrawer,
} from "./helpers/appHarness";

test.describe("Sheet-only Wait Mode", () => {
  test("keeps playback gated while the falling-notes ticker is visually hidden", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("display-mode-sheet").click();
    await closeTopDrawer(appPage);
    await waitForUiSettled(appPage);

    await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
    await expect(appPage.getByTestId("falling-notes-panel")).toBeHidden();

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
