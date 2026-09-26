import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  setDisplayMode,
} from "./helpers/appHarness";

test.describe("Sheet-only display mode", () => {
  test("split keeps the staff, falling notes, and keyboard", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    await expect(appPage.getByTestId("display-mode-sheet")).toHaveCount(0);
    await setDisplayMode(appPage, "split");
    await waitForUiSettled(appPage);

    await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
    await expect(appPage.getByTestId("falling-notes-panel")).toBeVisible();
    await expect(
      appPage.getByTestId("falling-notes-panel").locator("canvas"),
    ).toHaveCount(1);
    await expect(appPage.getByTestId("piano-keyboard")).toBeVisible();

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
