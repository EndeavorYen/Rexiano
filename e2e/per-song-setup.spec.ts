import { test, expect } from "./fixtures/electronApp";
import {
  choosePracticeMode,
  gotoLibrary,
  startBuiltInSongFromLibrary,
} from "./helpers/appHarness";

test.describe("Per-song practice setup", () => {
  test("offers all modes, marks Watch as the current default, and starts it", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.removeItem("rexiano-song-practice-setup");
    });
    await gotoLibrary(appPage);
    await startBuiltInSongFromLibrary(appPage, "chopsticks");

    await expect(appPage.getByTestId("mode-select-watch")).toBeVisible();
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible();
    await expect(appPage.getByTestId("mode-select-free")).toBeVisible();
    await expect(appPage.getByTestId("mode-select-current-default")).toHaveText(
      "Current default",
    );
    await expect(appPage.getByTestId("mode-select-watch")).toBeFocused();

    await choosePracticeMode(appPage, "watch");

    await expect(appPage.getByTestId("practice-mode-watch")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      appPage.getByRole("button", { name: "Pause (Space)" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("reopens a song with its saved Wait mode marked as current", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.removeItem("rexiano-song-practice-setup");
    });
    await gotoLibrary(appPage);
    await startBuiltInSongFromLibrary(appPage, "chopsticks");
    await choosePracticeMode(appPage, "wait");
    await expect(
      appPage.getByRole("button", { name: "Pause (Space)" }),
    ).toBeVisible({ timeout: 20_000 });

    await appPage.getByRole("button", { name: "Library" }).click();
    await expect(
      appPage.getByTestId("library-device-drawer-trigger"),
    ).toBeVisible();
    await startBuiltInSongFromLibrary(appPage, "chopsticks");

    await expect(appPage.getByTestId("mode-select-current-default")).toHaveText(
      "Current default",
    );
    await expect(appPage.getByTestId("mode-select-wait")).toHaveAccessibleName(
      "Wait, Current default",
    );
    await expect(appPage.getByTestId("mode-select-wait")).toBeFocused();
  });

  for (const dismissal of ["back", "escape", "backdrop"] as const) {
    test(`${dismissal} safely returns setup to the library without autoplay`, async ({
      appPage,
    }) => {
      await appPage.evaluate(() => {
        localStorage.removeItem("rexiano-song-practice-setup");
      });
      await gotoLibrary(appPage);
      await startBuiltInSongFromLibrary(appPage, "chopsticks");
      await expect(appPage.getByTestId("mode-select-watch")).toBeVisible();

      if (dismissal === "back") {
        await appPage.getByTestId("mode-select-back").click();
      } else if (dismissal === "escape") {
        await appPage.keyboard.press("Escape");
      } else {
        await appPage
          .getByTestId("mode-selection-backdrop")
          .click({ position: { x: 2, y: 2 } });
      }

      await expect(
        appPage.getByTestId("library-device-drawer-trigger"),
      ).toBeVisible();
      await expect(appPage.getByTestId("playback-header-panel")).toHaveCount(0);
      await appPage.waitForTimeout(350);
      await expect(appPage.getByTestId("playback-header-panel")).toHaveCount(0);
      await expect(
        appPage.getByRole("button", { name: "Pause (Space)" }),
      ).toHaveCount(0);
    });
  }

  test("mode choices stay usable in a narrow player window", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 390, height: 844 });
    await gotoLibrary(appPage);
    await startBuiltInSongFromLibrary(appPage, "chopsticks");

    const backdrop = appPage.getByTestId("mode-selection-backdrop");
    await expect(backdrop).toBeVisible();
    await expect(appPage.getByTestId("mode-select-watch")).toBeVisible();
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible();
    await expect(appPage.getByTestId("mode-select-free")).toBeVisible();
    await expect(appPage.getByTestId("mode-select-back")).toBeVisible();

    const overflow = await appPage.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
  });

  test("mode selection is saved for the loaded song without changing tracks", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.removeItem("rexiano-song-practice-setup");
    });
    await gotoLibrary(appPage);

    await startBuiltInSongFromLibrary(appPage, "chopsticks");
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible({
      timeout: 20_000,
    });
    await appPage.getByTestId("mode-select-wait").click();
    await expect(appPage.getByTestId("practice-toolbar")).toBeVisible();

    const savedSetup = await appPage.evaluate(() => {
      const raw = localStorage.getItem("rexiano-song-practice-setup");
      return raw ? JSON.parse(raw) : {};
    });

    expect(savedSetup["name:Chopsticks"]).toMatchObject({
      defaultMode: "wait",
    });
  });

  test("track selection changes are saved for the loaded song", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.removeItem("rexiano-song-practice-setup");
    });
    await gotoLibrary(appPage);

    await startBuiltInSongFromLibrary(appPage, "chopsticks");
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible({
      timeout: 20_000,
    });
    await appPage.getByTestId("mode-select-wait").click();

    await appPage
      .getByRole("button", { name: /Show advanced controls/i })
      .click();
    await appPage.getByRole("button", { name: "Mute All" }).click();

    const savedSetup = await appPage.evaluate(() => {
      const raw = localStorage.getItem("rexiano-song-practice-setup");
      return raw ? JSON.parse(raw) : {};
    });

    expect(savedSetup["name:Chopsticks"]).toMatchObject({
      activeTracks: [],
      defaultMode: "wait",
    });
  });
});
