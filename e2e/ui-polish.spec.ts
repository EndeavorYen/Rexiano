import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

test.describe("Playback UI polish guardrails", () => {
  test("header is compact and keeps title + metrics on the same row", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    const headerPanel = appPage.getByTestId("playback-header-panel");
    const title = appPage.getByTestId("playback-song-title");
    const chips = appPage.getByTestId("playback-header-chips");

    await expect(headerPanel).toBeVisible();
    await expect(title).toBeVisible();
    await expect(chips).toBeVisible();

    const [headerBox, titleBox, chipsBox] = await Promise.all([
      headerPanel.boundingBox(),
      title.boundingBox(),
      chips.boundingBox(),
    ]);

    expect(headerBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(chipsBox).not.toBeNull();
    if (!headerBox || !titleBox || !chipsBox) return;

    const titleCenterY = titleBox.y + titleBox.height / 2;
    const chipsCenterY = chipsBox.y + chipsBox.height / 2;

    expect(Math.abs(titleCenterY - chipsCenterY)).toBeLessThan(14);
    expect(headerBox.height).toBeLessThan(160);

    await expect(headerPanel.locator(".progress-rail")).toHaveCount(0);
    await expect(
      headerPanel.locator("svg.lucide-play, svg.lucide-pause"),
    ).toHaveCount(0);
  });

  test("transport uses volume ratio label and keeps volume slider visible", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    const transport = appPage.getByTestId("transport-strip");
    const practiceToolbar = appPage.getByTestId("practice-toolbar");
    const volumePercent = appPage.getByTestId("transport-volume-percent");
    const volumeControl = appPage.getByTestId("volume-control");
    const volumeSlider = appPage.getByTestId("volume-slider");

    await expect(transport).toBeVisible();
    await expect(volumePercent).toHaveText(/\d+%/);
    await expect(transport).not.toContainText("BPM");
    await expect(practiceToolbar).not.toContainText("BPM");

    const [controlBox, sliderBox] = await Promise.all([
      volumeControl.boundingBox(),
      volumeSlider.boundingBox(),
    ]);

    expect(controlBox).not.toBeNull();
    expect(sliderBox).not.toBeNull();
    if (!controlBox || !sliderBox) return;

    expect(sliderBox.height).toBeGreaterThanOrEqual(18);
    expect(sliderBox.y).toBeGreaterThanOrEqual(controlBox.y - 1);
    expect(sliderBox.y + sliderBox.height).toBeLessThanOrEqual(
      controlBox.y + controlBox.height + 1,
    );
  });
});
