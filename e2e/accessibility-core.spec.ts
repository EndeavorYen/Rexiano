import { test, expect, waitForUiSettled } from "./fixtures/app";
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

  test("library piano drawer supports keyboard open, focus trapping, and Escape", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);

    const drawerLauncher = appPage.getByTestId("library-device-drawer-trigger");
    await drawerLauncher.focus();
    await expect(drawerLauncher).toBeFocused();
    await appPage.keyboard.press("Enter");

    const drawer = appPage.getByRole("dialog", { name: /^Piano$/ });
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

  test("theme choice in settings is a pressed-button group that applies at once", async ({
    appPage,
  }) => {
    await appPage.getByTestId("main-menu-settings").click();
    const group = appPage
      .getByTestId("settings-appearance")
      .getByRole("group", { name: "Theme" });
    const dark = group.getByRole("button", { name: "Dark" });
    const system = group.getByRole("button", { name: "System" });
    await expect(system).toHaveAttribute("aria-pressed", "true");

    await dark.focus();
    await appPage.keyboard.press("Enter");
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    await expect(appPage.locator("html")).toHaveAttribute("data-theme", "dark");

    await appPage.reload();
    await expect(appPage.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("what's new opens from the top bar, clears the red dot, and restores focus", async ({
    appPage,
  }) => {
    const info = appPage.getByTestId("changelog");
    await expect(info.locator(".dot")).toHaveCount(1);
    await info.focus();
    await appPage.keyboard.press("Enter");
    const sheet = appPage.getByRole("dialog", { name: "What's new" });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("article.new")).toHaveCount(1);
    await appPage.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(info).toBeFocused();
    await expect(info.locator(".dot")).toHaveCount(0);

    await appPage.reload();
    await expect(appPage.getByTestId("changelog").locator(".dot")).toHaveCount(
      0,
    );
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
      appPage.getByTestId("transport-strip").getByTestId("metronome-toggle"),
    ).toHaveCount(0);
  });

  test("playback header has no Insights control", async ({ appPage }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await expect(appPage.getByTestId("playback-header-actions")).toBeVisible();
    await expect(appPage.getByTestId("insights-trigger")).toHaveCount(0);
    await expect(appPage.getByTestId("insights-dialog")).toHaveCount(0);
    await expect(appPage.getByTestId("insights-backdrop")).toHaveCount(0);
    await expect(
      appPage.getByRole("dialog", { name: "Practice Insights" }),
    ).toHaveCount(0);
    await expect(appPage.getByTestId("playback-drawer-trigger")).toBeVisible();
    await expect(appPage.locator(".app-shell")).not.toHaveAttribute("inert");
  });
});
