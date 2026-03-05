import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  openPlaybackDrawer,
  pausePlaybackIfRunning,
  resetPlaybackPosition,
} from "./helpers/appHarness";

test.describe("Overlay and shortcut guardrails", () => {
  test("Escape closes only the top settings layer and keeps drawer visible", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await pausePlaybackIfRunning(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("settings-trigger").click();
    await expect(appPage.getByTestId("settings-panel")).toBeVisible();

    await appPage.keyboard.press("Escape");

    await expect(appPage.getByTestId("settings-panel")).toBeHidden();
    await expect(appPage.getByTestId("playback-settings-drawer")).toBeVisible();
  });

  test("playback shortcuts are suspended while settings panel is focused", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await pausePlaybackIfRunning(appPage);
    await resetPlaybackPosition(appPage);
    await waitForUiSettled(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("settings-trigger").click();
    await expect(appPage.getByTestId("settings-panel")).toBeVisible();
    await appPage.getByTestId("settings-tab-theme").click();

    const seekSlider = appPage.getByRole("slider", {
      name: /seek position/i,
    });
    const playButton = appPage
      .getByTestId("transport-strip")
      .locator("button")
      .first();
    const seekBefore = Number(await seekSlider.inputValue());
    const playBefore = await playButton.getAttribute("aria-label");

    await appPage.keyboard.press("ArrowRight");
    await appPage.keyboard.press("Space");

    const seekAfter = Number(await seekSlider.inputValue());
    const playAfter = await playButton.getAttribute("aria-label");
    expect(seekAfter).toBe(seekBefore);
    expect(playAfter).toBe(playBefore);
  });

  test("settings panel traps keyboard focus", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await pausePlaybackIfRunning(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("settings-trigger").click();
    await expect(appPage.getByTestId("settings-panel")).toBeVisible();
    await appPage.getByTestId("settings-tab-theme").click();

    let escapedModal = false;
    for (let i = 0; i < 60; i++) {
      await appPage.keyboard.press("Tab");
      const focusInside = await appPage.evaluate(() => {
        const panel = document.querySelector("[data-testid='settings-panel']");
        const active = document.activeElement;
        return !!panel && !!active && panel.contains(active);
      });
      if (!focusInside) {
        escapedModal = true;
        break;
      }
    }

    expect(escapedModal).toBe(false);
  });

  test("only one aria-modal dialog remains active when settings panel opens", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await pausePlaybackIfRunning(appPage);

    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("settings-trigger").click();
    await expect(appPage.getByTestId("settings-panel")).toBeVisible();

    const activeModalCount = await appPage.evaluate(() => {
      return document.querySelectorAll("[role='dialog'][aria-modal='true']")
        .length;
    });
    expect(activeModalCount).toBe(1);
  });

  test("playback header keeps metadata chips visible at 320px width", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 320, height: 844 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await pausePlaybackIfRunning(appPage);
    await waitForUiSettled(appPage);

    const header = appPage.getByTestId("playback-header-panel");
    const chips = appPage.getByTestId("playback-header-chips");
    const actions = appPage.getByTestId("playback-header-actions");

    await expect(header).toBeVisible();
    await expect(chips).toBeVisible();
    await expect(actions).toBeVisible();

    const chipsBox = await chips.boundingBox();
    expect(chipsBox).not.toBeNull();
    if (chipsBox) {
      expect(chipsBox.width).toBeGreaterThan(60);
    }
  });
});
