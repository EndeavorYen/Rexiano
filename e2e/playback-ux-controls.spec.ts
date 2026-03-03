import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  openLibraryDrawer,
  openPlaybackDrawer,
  pausePlaybackIfRunning,
  resetPlaybackPosition,
} from "./helpers/appHarness";

test.describe("Playback UX controls", () => {
  test("Escape closes playback drawer without pausing playback", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    const playButton = appPage
      .getByTestId("transport-strip")
      .locator("button")
      .first();
    const playbackStateBefore = await playButton.getAttribute("aria-label");
    expect(playbackStateBefore).toBeTruthy();

    await openPlaybackDrawer(appPage);
    await appPage.keyboard.press("Escape");

    await expect(appPage.getByTestId("playback-settings-drawer")).toBeHidden();
    const playbackStateAfter = await playButton.getAttribute("aria-label");
    expect(playbackStateAfter).toBe(playbackStateBefore);
  });

  test("Escape closes library MIDI drawer", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await openLibraryDrawer(appPage);

    await appPage.keyboard.press("Escape");
    await expect(appPage.getByTestId("library-midi-drawer")).toBeHidden();
  });

  test("space + seek + speed shortcuts update playback controls", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await pausePlaybackIfRunning(appPage);
    await resetPlaybackPosition(appPage);
    await waitForUiSettled(appPage);

    const playButton = appPage
      .getByTestId("transport-strip")
      .locator("button")
      .first();
    const seekSlider = appPage.getByRole("slider", {
      name: /seek position/i,
    });

    await appPage.locator("body").click();
    const playbackStateBefore = await playButton.getAttribute("aria-label");
    expect(playbackStateBefore).toBeTruthy();
    await appPage.keyboard.press("Space");
    const playbackStateAfterSpace = await playButton.getAttribute("aria-label");
    expect(playbackStateAfterSpace).toBeTruthy();
    expect(playbackStateAfterSpace).not.toBe(playbackStateBefore);

    const beforeSeek = Number(await seekSlider.inputValue());
    await appPage.keyboard.press("ArrowRight");
    const afterSeek = Number(await seekSlider.inputValue());
    expect(afterSeek - beforeSeek).toBeGreaterThanOrEqual(4.9);

    await appPage.keyboard.press("ArrowUp");
    await expect(appPage.getByTestId("playback-header-chips")).toContainText(
      "125%",
    );

    await appPage.keyboard.press("ArrowDown");
    await expect(appPage.getByTestId("playback-header-chips")).toContainText(
      "100%",
    );
  });

  test("Escape closes insights modal first", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await pausePlaybackIfRunning(appPage);
    await resetPlaybackPosition(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("insights-trigger").click();

    await expect(appPage.getByTestId("insights-modal")).toBeVisible();
    await appPage.keyboard.press("Escape");
    await expect(appPage.getByTestId("insights-modal")).toBeHidden();
  });
});
