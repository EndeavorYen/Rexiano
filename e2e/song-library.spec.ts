import { writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import type { Locator } from "@playwright/test";
import { createImportedSongId } from "../src/renderer/src/features/songLibrary/importedSongMetadata";
import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

async function resetLibraryPrefs(appPage: {
  evaluate: (fn: () => void) => Promise<void>;
  reload: () => Promise<unknown>;
}): Promise<void> {
  await appPage.evaluate(() => {
    localStorage.setItem(
      "rexiano-song-library",
      JSON.stringify({
        viewMode: "list",
        sortMode: "recent",
        favoriteSongIds: [],
      }),
    );
  });
  await appPage.reload();
}

function previewMetricValue(preview: Locator, label: string): Locator {
  return preview
    .locator("dt")
    .filter({ hasText: label })
    .locator("xpath=following-sibling::dd[1]");
}

test.describe("Song library selection workflow", () => {
  test("shows a recommended next-song action and opens practice from it", async ({
    appPage,
  }) => {
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const recommendation = appPage.getByTestId("song-library-recommendation");
    await expect(recommendation).toBeVisible();
    await expect(
      recommendation.getByTestId("song-library-recommendation-title"),
    ).not.toHaveText("");

    await recommendation.click();
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("shows quiet daily practice goal progress on the launcher", async ({
    appPage,
  }) => {
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const dailyGoal = appPage.getByTestId("library-daily-goal");
    await expect(dailyGoal).toBeVisible();
    await expect(dailyGoal).toContainText("Daily goal");
    await expect(dailyGoal).toContainText("0 / 10 min");
  });

  test("supports compact list sorting and favorite pinning", async ({
    appPage,
  }) => {
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const list = appPage.getByTestId("song-library-list");
    await expect(list).toBeVisible();

    await appPage.getByTestId("song-library-sort").selectOption("title");
    const titleTexts = await appPage
      .getByTestId("song-list-row-title")
      .allTextContents();
    const sortedTitles = [...titleTexts].sort((a, b) => a.localeCompare(b));
    expect(titleTexts.slice(0, 6)).toEqual(sortedTitles.slice(0, 6));

    const lastFavoriteButton = appPage
      .getByTestId("song-favorite-toggle")
      .last();
    const favoriteTitle = await appPage
      .getByTestId("song-list-row-title")
      .last()
      .textContent();
    await lastFavoriteButton.click();

    await appPage.getByTestId("song-library-sort").selectOption("recent");
    await expect(appPage.getByTestId("song-list-row-title").first()).toHaveText(
      favoriteTitle ?? "",
    );
    await expect(
      appPage.getByTestId("song-favorite-toggle").first(),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("keeps the full built-in library reachable inside the viewport", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const finalSongButton = appPage.getByTestId("song-select-yankee-doodle");
    await finalSongButton.scrollIntoViewIfNeeded();

    await expect(finalSongButton).toBeInViewport();
    const libraryMidiButton = appPage.getByTestId(
      "library-device-drawer-trigger",
    );
    await expect(libraryMidiButton).toBeInViewport();
    const scrollMetrics = await finalSongButton.evaluate((element) => {
      let parent = element.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          parent.scrollHeight > parent.clientHeight
        ) {
          return {
            clientHeight: parent.clientHeight,
            scrollHeight: parent.scrollHeight,
            scrollTop: parent.scrollTop,
            viewportHeight: window.innerHeight,
          };
        }
        parent = parent.parentElement;
      }
      return null;
    });

    if (!scrollMetrics) {
      throw new Error("Expected the song library to expose a scroll container");
    }
    expect(scrollMetrics.clientHeight).toBeLessThanOrEqual(
      scrollMetrics.viewportHeight,
    );
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(
      scrollMetrics.clientHeight,
    );
    expect(scrollMetrics.scrollTop).toBeGreaterThan(0);
  });

  test("shows selected-song preview before starting practice", async ({
    appPage,
  }) => {
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const hotCrossBuns = appPage.getByTestId("song-select-hot-cross-buns");
    await hotCrossBuns.click();

    const preview = appPage.getByTestId("song-selection-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Hot Cross Buns");
    await expect(preview).toContainText("L0");
    await expect(preview).toContainText("Not practiced");
    await expect(previewMetricValue(preview, "Tracks")).toHaveText("1");
    await expect(
      preview.getByTestId("song-selection-preview-audio"),
    ).toHaveText("Preview");
    await expect(appPage.getByTestId("mode-select-wait")).toBeHidden();

    await preview.getByTestId("song-selection-preview-practice").click();
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("shows imported-song preview before starting practice", async ({
    appPage,
    electronApp,
  }) => {
    const sourcePath = resolve("resources/midi/c-major-scale.mid");
    const watchedFolder = dirname(sourcePath);
    const importedSongId = createImportedSongId(sourcePath);
    const userDataPath = await electronApp.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    writeFileSync(
      join(userDataPath, "midi-path-access.json"),
      JSON.stringify({ files: [], folders: [watchedFolder] }, null, 2),
      "utf-8",
    );

    await appPage.evaluate(
      ({ importedSongId, sourcePath, watchedFolder }) => {
        localStorage.setItem(
          "rexiano-song-library",
          JSON.stringify({
            viewMode: "list",
            sortMode: "recent",
            favoriteSongIds: [],
            watchedFolders: [watchedFolder],
            importedSongs: [
              {
                id: importedSongId,
                sourcePath,
                title: "Lesson Scale",
                composer: "Teacher",
                tags: ["legato", "recital"],
                category: "exercise",
                grade: 2,
                missing: false,
              },
            ],
          }),
        );
      },
      { importedSongId, sourcePath, watchedFolder },
    );
    await appPage.reload();
    await gotoLibrary(appPage);

    await appPage.getByTestId(`imported-song-select-${importedSongId}`).click();

    const preview = appPage.getByTestId("song-selection-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Lesson Scale");
    await expect(preview).toContainText("Teacher");
    await expect(preview).toContainText("L2");
    await expect(preview).toContainText("Exercises");
    await expect(preview).toContainText("Not practiced");
    await expect(previewMetricValue(preview, "Tracks")).toHaveText("1");
    await expect(
      preview.getByTestId("song-selection-preview-audio"),
    ).toHaveText("Preview");
    await expect(appPage.getByTestId("mode-select-wait")).toBeHidden();

    await preview.getByTestId("song-selection-preview-practice").click();
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("shows a continue practice action after loading a song", async ({
    appPage,
  }) => {
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const firstTitle = await appPage
      .getByTestId("song-select-hot-cross-buns")
      .getByTestId("song-list-row-title")
      .textContent();

    await loadFirstBuiltInSong(appPage);
    await appPage.getByRole("button", { name: /Library|曲庫/ }).click();
    await gotoLibrary(appPage);

    const continuePractice = appPage.getByTestId("song-library-continue");
    await expect(continuePractice).toBeVisible();
    await expect(continuePractice).toContainText(firstTitle ?? "");
  });
});
