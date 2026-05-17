import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

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
    await loadFirstBuiltInSong(appPage);

    const playButton = appPage.getByRole("button", { name: "Play (Space)" });

    await expect(playButton).toBeVisible();
    await expect(
      appPage.getByRole("button", { name: "Reset to beginning" }),
    ).toBeVisible();
    await expect(appPage.getByTestId("metronome-toggle")).toHaveCount(0);
    await expect(appPage.getByTestId("transport-volume-percent")).toHaveCount(
      0,
    );
    await expect(appPage.getByTestId("practice-toolbar-level")).toHaveCount(0);

    await playButton.click();

    appPage.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Practice is still playing");
      await dialog.dismiss();
    });
    await appPage.getByRole("button", { name: "Library" }).click();
    await expect(appPage.locator(".workspace-frame")).toBeVisible();

    appPage.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Practice is still playing");
      await dialog.accept();
    });
    await appPage.getByRole("button", { name: "Library" }).click();
    await expect(
      appPage.getByRole("button", { name: /Start Practicing/i }),
    ).toBeVisible();
  });
});
