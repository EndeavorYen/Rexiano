import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

// Focused suite for #13/#15: run this when changing keyboard access,
// modal/drawer surfaces, or primary playback controls.

async function expectFocusWithin(
  appPage: Parameters<typeof waitForUiSettled>[0],
  selector: string,
): Promise<void> {
  await expect
    .poll(
      () =>
        appPage.evaluate((rootSelector) => {
          const root = document.querySelector(rootSelector);
          return !!root && root.contains(document.activeElement);
        }, selector),
      { timeout: 2_000 },
    )
    .toBe(true);
}

test.describe("Core accessibility guardrails", () => {
  test("settings dialog traps keyboard focus and restores launcher focus", async ({
    appPage,
  }) => {
    const settingsLauncher = appPage
      .getByRole("button", { name: /^Settings$/ })
      .first();

    await settingsLauncher.focus();
    await expect(settingsLauncher).toBeFocused();
    await appPage.keyboard.press("Enter");

    const dialog = appPage.getByRole("dialog", { name: /^Settings$/ });
    await expect(dialog).toBeVisible();
    await expectFocusWithin(appPage, "[data-testid='settings-panel']");

    for (let i = 0; i < 8; i++) {
      await appPage.keyboard.press("Tab");
      await expectFocusWithin(appPage, "[data-testid='settings-panel']");
    }

    await appPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(settingsLauncher).toBeFocused();
  });

  test("library MIDI drawer supports keyboard open, focus trapping, and Escape", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);

    const drawerLauncher = appPage.getByTestId("library-device-drawer-trigger");
    await drawerLauncher.focus();
    await expect(drawerLauncher).toBeFocused();
    await appPage.keyboard.press("Enter");

    const drawer = appPage.getByRole("dialog", { name: /^MIDI$/ });
    await expect(drawer).toBeVisible();
    await expectFocusWithin(appPage, "[data-testid='library-midi-drawer']");

    for (let i = 0; i < 5; i++) {
      await appPage.keyboard.press("Tab");
      await expectFocusWithin(appPage, "[data-testid='library-midi-drawer']");
    }

    await appPage.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(drawerLauncher).toBeFocused();
  });

  test("playback drawer and transport controls expose keyboard-safe names", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    const drawerLauncher = appPage.getByTestId("playback-drawer-trigger");
    await drawerLauncher.focus();
    await expect(drawerLauncher).toBeFocused();
    await appPage.keyboard.press("Enter");

    const drawer = appPage.getByRole("dialog", { name: /^Settings$/ });
    await expect(drawer).toBeVisible();
    await expectFocusWithin(
      appPage,
      "[data-testid='playback-settings-drawer']",
    );

    await appPage.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(drawerLauncher).toBeFocused();

    const playButton = appPage
      .getByTestId("transport-strip")
      .getByRole("button", { name: /Play \(Space\)|Pause \(Space\)/ });
    await expect(playButton).toBeVisible();
    await playButton.focus();
    await expect(playButton).toBeFocused();
    await appPage.keyboard.press("Enter");
    await expect(playButton).toHaveAccessibleName(/Play|Pause/);
    await expect(
      appPage
        .getByTestId("transport-strip")
        .getByRole("button", { name: /Reset to beginning/ }),
    ).toBeVisible();
    await expect(
      appPage.getByTestId("transport-strip").getByRole("button", {
        name: /Enable metronome|Disable metronome/,
      }),
    ).toBeVisible();
  });
});
