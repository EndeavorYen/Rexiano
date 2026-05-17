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
