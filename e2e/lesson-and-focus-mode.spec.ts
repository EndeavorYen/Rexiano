import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, startBuiltInSongFromLibrary } from "./helpers/appHarness";

test.describe("Lesson path and child focus mode", () => {
  test("library shows a guided lesson path without blocking free song selection", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);

    await expect(appPage.getByTestId("lesson-progression-panel")).toBeVisible();
    await expect(appPage.getByTestId("lesson-progression-next")).toContainText(
      /Au Clair de la Lune|Hot Cross Buns/,
    );
    await expect(appPage.getByTestId("lesson-group-first-notes")).toContainText(
      "First notes",
    );

    await appPage.getByTestId("song-library-view-list").click();
    await expect(
      appPage.getByTestId("song-select-hot-cross-buns"),
    ).toBeVisible();
  });

  test("child focus mode keeps essentials and guards active practice exits", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.setItem(
        "rexiano-settings",
        JSON.stringify({
          language: "en",
          defaultMode: "watch",
          metronomeEnabled: false,
          showNoteLabels: true,
          showFallingNoteLabels: true,
          childFocusMode: true,
        }),
      );
    });
    await appPage.reload();
    await appPage.waitForLoadState("domcontentloaded");

    await gotoLibrary(appPage);
    await startBuiltInSongFromLibrary(appPage, "hot-cross-buns");
    const freeModeOption = appPage.getByTestId("mode-select-free");
    if (await freeModeOption.isVisible()) {
      await freeModeOption.click();
    }
    await expect(appPage.locator(".workspace-frame")).toBeVisible({
      timeout: 20_000,
    });

    const ensurePlaybackIsRunning = async (): Promise<void> => {
      const pauseButton = appPage.getByRole("button", {
        name: "Pause (Space)",
      });
      if (await pauseButton.isVisible()) return;
      await appPage.getByRole("button", { name: "Play (Space)" }).click();
      await expect(pauseButton).toBeVisible();
    };

    await expect(
      appPage.getByRole("button", { name: "Play (Space)" }),
    ).toBeVisible();
    await expect(
      appPage.getByRole("button", { name: "Reset to beginning" }),
    ).toBeVisible();
    await expect(appPage.getByTestId("metronome-toggle")).toHaveCount(0);
    await expect(appPage.getByTestId("transport-volume-percent")).toHaveCount(
      0,
    );
    await expect(appPage.getByTestId("practice-toolbar-level")).toHaveCount(0);

    await ensurePlaybackIsRunning();

    const dismissExitDialog = appPage.waitForEvent("dialog");
    const dismissClick = appPage
      .getByRole("button", { name: "Library" })
      .click();
    const dismissDialog = await dismissExitDialog;
    expect(dismissDialog.message()).toContain("Practice is still playing");
    await dismissDialog.dismiss();
    await dismissClick;
    await expect(appPage.locator(".workspace-frame")).toBeVisible();

    await ensurePlaybackIsRunning();

    const acceptExitDialog = appPage.waitForEvent("dialog");
    const acceptClick = appPage
      .getByRole("button", { name: "Library" })
      .click();
    const acceptDialog = await acceptExitDialog;
    expect(acceptDialog.message()).toContain("Practice is still playing");
    await acceptDialog.accept();
    await acceptClick;
    await expect(
      appPage.getByRole("button", { name: /Start Practicing/i }),
    ).toBeVisible();
  });
});
